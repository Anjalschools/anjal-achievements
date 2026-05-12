import mongoose from "mongoose";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { publicAlumniOpportunityListingFilter } from "@/lib/alumni/normalize-opportunity-status";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";
import type { MatchProfileInput, MentorCandidate, RankedMentor } from "@/lib/alumni/matching/mentor-matching";
import { rankMentors } from "@/lib/alumni/matching/mentor-matching";
import { rankOpportunities, type OpportunityCandidate, type RankedOpportunity } from "@/lib/alumni/matching/opportunity-matching";
import { rankAlumniEvents, type AlumniEventCandidate, type RankedAlumniEvent } from "@/lib/alumni/matching/event-matching";

const isMentorService = (alumniProfile: unknown): boolean => {
  const p = (alumniProfile as Record<string, unknown> | undefined) || {};
  const services = (p.alumniServices as Record<string, unknown> | undefined) || {};
  return services.mentoring === true;
};

const mapUserToCandidate = (row: Record<string, unknown>): MentorCandidate => {
  const p = (row.alumniProfile as Record<string, unknown> | undefined) || {};
  return {
    id: (row._id as mongoose.Types.ObjectId).toString(),
    fullName: String(row.fullName || ""),
    universityName: (p.universityName as string | null | undefined) ?? null,
    major: (p.major as string | null | undefined) ?? null,
    industry: (p.industry as string | null | undefined) ?? null,
    country: (p.country as string | null | undefined) ?? null,
    studyCountry: (p.studyCountry as string | null | undefined) ?? null,
    graduationYear: (p.graduationYear as number | null | undefined) ?? null,
    interests: Array.isArray(p.interests) ? (p.interests as string[]) : null,
    bio: (p.bio as string | null | undefined) ?? null,
    updatedAt: (row.updatedAt as Date | null | undefined) ?? null,
    lastLoginAt: (row.lastLoginAt as Date | null | undefined) ?? null,
    isVerifiedAlumni: p.isVerifiedAlumni === true,
    reputationScore: (p.reputationScore as number | null | undefined) ?? null,
  };
};

export type RecommendationEngineV1Result = {
  version: 1;
  similarAlumni: Array<
    Pick<MentorCandidate, "id" | "fullName" | "universityName" | "industry" | "major"> & {
      matchScore: number;
      matchReasons: string[];
      matchWeights: Record<string, number>;
      matchedSignals: Record<string, boolean>;
      confidence: number;
      relevanceScore: number;
    }
  >;
  mentors: RankedMentor[];
  opportunities: RankedOpportunity[];
  events: RankedAlumniEvent[];
  potentialGroups: Array<{
    cohortYear: number;
    alumniCount: number;
    universityName?: string;
    reasons: string[];
    relevanceScore: number;
    confidence: number;
  }>;
};

const loadOpportunities = async (): Promise<OpportunityCandidate[]> => {
  const now = new Date();
  const rows = await AlumniOpportunity.find({
    ...publicAlumniOpportunityListingFilter(now),
  })
    .select("title description type company location featured")
    .sort({ featured: -1, updatedAt: -1 })
    .limit(80)
    .lean();

  return rows.map((row) => ({
    id: (row as { _id: mongoose.Types.ObjectId })._id.toString(),
    title: String((row as { title?: string }).title || ""),
    description: (row as { description?: string | null }).description ?? null,
    type: String((row as { type?: string }).type || ""),
    company: (row as { company?: string | null }).company ?? null,
    location: (row as { location?: string | null }).location ?? null,
    featured: (row as { featured?: boolean }).featured === true,
  }));
};

const loadEvents = async (): Promise<AlumniEventCandidate[]> => {
  const now = new Date();
  const rows = await AlumniReunionEvent.find({
    published: true,
    startsAt: { $gte: now },
  })
    .sort({ featured: -1, startsAt: 1 })
    .limit(48)
    .select("title summary content eventType cohortYear location featured startsAt")
    .lean();

  return rows.map((row) => ({
    id: (row as { _id: mongoose.Types.ObjectId })._id.toString(),
    title: String((row as { title?: string }).title || ""),
    summary: (row as { summary?: string | null }).summary ?? null,
    content: (row as { content?: string | null }).content ?? null,
    eventType: String((row as { eventType?: string }).eventType || ""),
    cohortYear: (row as { cohortYear?: number | null }).cohortYear ?? null,
    location: (row as { location?: string | null }).location ?? null,
    featured: (row as { featured?: boolean }).featured === true,
    startsAt: (row as { startsAt: Date }).startsAt,
  }));
};

const cohortClustersForViewer = async (
  viewer: MatchProfileInput
): Promise<RecommendationEngineV1Result["potentialGroups"]> => {
  const uni = (viewer.universityName || "").trim();
  const match: Record<string, unknown> = {
    $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()],
    "alumniProfile.graduationYear": { $exists: true, $nin: [null, ""] },
  };
  if (uni) {
    match["alumniProfile.universityName"] = uni;
  }

  const rows = await User.aggregate<{ _id: unknown; c: number }>([
    { $match: match },
    { $group: { _id: "$alumniProfile.graduationYear", c: { $sum: 1 } } },
    { $sort: { c: -1 } },
    { $limit: 16 },
  ]);

  const merged = new Map<number, number>();
  for (const r of rows) {
    const y = normalizeGraduationYearToNumber(r._id);
    if (y == null) continue;
    merged.set(y, (merged.get(y) || 0) + r.c);
  }
  const mergedRows = [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cohortYear, c]) => ({ cohortYear, c }));

  const maxC = mergedRows[0]?.c || 1;
  return mergedRows.map((r) => ({
    cohortYear: r.cohortYear,
    alumniCount: r.c,
    universityName: uni || undefined,
    reasons: uni ? ["same_university_network", "cohort_cluster"] : ["graduation_cohort_cluster"],
    relevanceScore: Math.round((r.c / maxC) * 1000) / 10,
    confidence: Math.min(0.95, 0.35 + (r.c / maxC) * 0.55),
  }));
};

/**
 * Unified, explainable recommendation bundle (rules-only).
 */
export const runRecommendationEngineV1 = async (
  viewerId: string,
  viewer: MatchProfileInput
): Promise<RecommendationEngineV1Result> => {
  const exclude =
    viewerId && mongoose.isValidObjectId(viewerId) ? new mongoose.Types.ObjectId(viewerId) : undefined;

  const basePeerMatch: Record<string, unknown> = {
    $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()],
  };
  if (exclude) basePeerMatch._id = { $ne: exclude };

  const peerRows = await User.find(basePeerMatch)
    .select("fullName alumniProfile updatedAt lastLoginAt")
    .sort({ updatedAt: -1 })
    .limit(180)
    .lean();

  const peerRowsLean = peerRows as unknown as Array<Record<string, unknown>>;
  const nonMentorRows = peerRowsLean.filter((row) => !isMentorService(row.alumniProfile));
  const peerSourceRows = nonMentorRows.length >= 24 ? nonMentorRows : peerRowsLean;
  const peerPool = peerSourceRows.map((row) => mapUserToCandidate(row));

  const rankedPeers = rankMentors(viewer, peerPool, viewerId, 14).map((m) => ({
    id: m.id,
    fullName: m.fullName,
    universityName: m.universityName,
    industry: m.industry,
    major: m.major,
    matchScore: m.matchScore,
    matchReasons: m.matchReasons,
    matchWeights: m.matchWeights,
    matchedSignals: m.matchedSignals,
    confidence: m.matchConfidence,
    relevanceScore: m.matchRelevanceScore,
  }));

  const mentorRows = await User.find({
    ...basePeerMatch,
    "alumniProfile.alumniServices.mentoring": true,
  })
    .select("fullName alumniProfile updatedAt lastLoginAt")
    .limit(120)
    .lean();

  const mentors = rankMentors(
    viewer,
    mentorRows.map((row) => mapUserToCandidate(row as unknown as Record<string, unknown>)),
    viewerId,
    14
  );

  const opps = await loadOpportunities();
  const opportunities = rankOpportunities(viewer, opps, 14);

  const events = rankAlumniEvents(viewer, await loadEvents(), 12);
  const potentialGroups = await cohortClustersForViewer(viewer);

  return {
    version: 1,
    similarAlumni: rankedPeers,
    mentors,
    opportunities,
    events,
    potentialGroups,
  };
};
