import mongoose from "mongoose";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import { publicAlumniOpportunityListingFilter } from "@/lib/alumni/normalize-opportunity-status";
import type { MatchProfileInput } from "@/lib/alumni/matching/mentor-matching";
import {
  rankMentors,
  scoreMentor,
  type MentorCandidate,
} from "@/lib/alumni/matching/mentor-matching";
import { rankOpportunities, type OpportunityCandidate } from "@/lib/alumni/matching/opportunity-matching";
import type { AlumniAssistantIntent } from "./types";
import { tryEnrichAssistantFocusWithOpenAI } from "./openai-optional";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

const CAREER_CLUSTERS: Record<string, string[]> = {
  ai: ["ai", "artificial intelligence", "machine learning", "ml", "deep learning", "ذكاء اصطناعي"],
  medicine: ["medicine", "medical", "physician", "طب", "صحة"],
  cybersecurity: ["cyber", "security", "infosec", "أمن سيبراني", "cybersecurity"],
};

const buildViewer = (base: MatchProfileInput, focus?: string): MatchProfileInput => {
  const f = norm(focus);
  if (!f) return base;
  return {
    ...base,
    industry: base.industry || (CAREER_CLUSTERS.cybersecurity.some((k) => f.includes(k)) ? "cybersecurity" : base.industry),
    major: base.major || (CAREER_CLUSTERS.ai.some((k) => f.includes(k)) ? "computer science" : base.major),
  };
};

const loadMentorPool = async (excludeId?: string): Promise<MentorCandidate[]> => {
  const filter: Record<string, unknown> = {
    accountType: "alumni",
    "alumniProfile.alumniServices.mentoring": true,
  };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  }
  const rows = await User.find(filter)
    .select("fullName alumniProfile updatedAt lastLoginAt")
    .limit(120)
    .lean();

  return rows.map((row: any) => {
    const p = row.alumniProfile || {};
    return {
      id: row._id.toString(),
      fullName: row.fullName || "",
      universityName: p.universityName ?? null,
      major: p.major ?? null,
      industry: p.industry ?? null,
      country: p.country ?? null,
      studyCountry: p.studyCountry ?? null,
      graduationYear: p.graduationYear ?? null,
      bio: p.bio ?? null,
      updatedAt: row.updatedAt ?? null,
      lastLoginAt: row.lastLoginAt ?? null,
      isVerifiedAlumni: p.isVerifiedAlumni === true,
      reputationScore: p.reputationScore ?? null,
    };
  });
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

  return rows.map((row: any) => ({
    id: row._id.toString(),
    title: row.title || "",
    description: row.description ?? null,
    type: row.type || "",
    company: row.company ?? null,
    location: row.location ?? null,
    featured: row.featured === true,
  }));
};

const universitySuggestions = async (viewer: MatchProfileInput) => {
  const majorHint = norm(viewer.major) || norm(viewer.industry);
  const match: Record<string, unknown> = {
    accountType: "alumni",
    "alumniProfile.universityName": { $exists: true, $nin: [null, ""] },
  };
  if (majorHint) {
    match["alumniProfile.major"] = new RegExp(escapeRegExp(majorHint), "i");
  }

  const rows = await User.aggregate<{ _id: string; count: number }>([
    { $match: match },
    { $group: { _id: "$alumniProfile.universityName", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  return rows.map((r) => ({ universityName: r._id, alumniCount: r.count }));
};

const careerInsightCounts = async (focus?: string) => {
  const f = norm(focus);
  let keywords: string[] = [];
  for (const [key, words] of Object.entries(CAREER_CLUSTERS)) {
    if (words.some((w) => f.includes(w) || key === f)) {
      keywords = words;
      break;
    }
  }
  if (!keywords.length && f) keywords = [f];

  const industryMatch: Record<string, unknown> = { accountType: "alumni" };
  if (keywords.length) {
    industryMatch.$or = keywords.map((k) => ({
      "alumniProfile.industry": new RegExp(escapeRegExp(k), "i"),
    }));
  }

  const count = keywords.length
    ? await User.countDocuments(industryMatch)
    : await User.countDocuments({ accountType: "alumni", "alumniProfile.industry": { $exists: true, $nin: [""] } });

  return {
    focus: f || "general",
    alumniMatchingFocus: count,
    clusters: Object.keys(CAREER_CLUSTERS),
  };
};

const networkSuggest = async (viewer: MatchProfileInput, selfId?: string) => {
  const filter: Record<string, unknown> = { accountType: "alumni" };
  if (selfId && mongoose.isValidObjectId(selfId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(selfId) };
  }
  const rows = await User.find(filter)
    .select("fullName alumniProfile updatedAt lastLoginAt")
    .sort({ updatedAt: -1 })
    .limit(80)
    .lean();

  const candidates: MentorCandidate[] = rows.map((row: any) => {
    const p = row.alumniProfile || {};
    return {
      id: row._id.toString(),
      fullName: row.fullName || "",
      universityName: p.universityName ?? null,
      major: p.major ?? null,
      industry: p.industry ?? null,
      country: p.country ?? null,
      studyCountry: p.studyCountry ?? null,
      graduationYear: p.graduationYear ?? null,
      bio: p.bio ?? null,
      updatedAt: row.updatedAt ?? null,
      lastLoginAt: row.lastLoginAt ?? null,
      isVerifiedAlumni: p.isVerifiedAlumni === true,
      reputationScore: p.reputationScore ?? null,
    };
  });

  return candidates
    .map((c) => {
      const { score, reasons } = scoreMentor(viewer, c, selfId);
      return {
        id: c.id,
        fullName: c.fullName,
        universityName: c.universityName,
        industry: c.industry,
        matchScore: score,
        matchReasons: reasons,
      };
    })
    .filter((x) => x.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8);
};

export const runAlumniAssistantRecommend = async (
  intent: AlumniAssistantIntent,
  viewerBase: MatchProfileInput,
  opts: { selfUserId?: string; focus?: string; profileOverlay?: Partial<MatchProfileInput> }
): Promise<unknown> => {
  void tryEnrichAssistantFocusWithOpenAI(opts.focus || "");
  const viewer: MatchProfileInput = {
    ...viewerBase,
    ...opts.profileOverlay,
  };
  const focusedViewer = buildViewer(viewer, opts.focus);

  switch (intent) {
    case "mentor_suggest": {
      const pool = await loadMentorPool(opts.selfUserId);
      return rankMentors(focusedViewer, pool, opts.selfUserId, 6).map((m) => ({
        id: m.id,
        fullName: m.fullName,
        universityName: m.universityName,
        matchScore: m.matchScore,
        matchReasons: m.matchReasons,
      }));
    }
    case "opportunity_pick": {
      const opps = await loadOpportunities();
      return rankOpportunities(focusedViewer, opps, 8).map((o) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        matchScore: o.matchScore,
        matchReasons: o.matchReasons,
      }));
    }
    case "university_explorer": {
      return universitySuggestions(focusedViewer);
    }
    case "career_insight": {
      return careerInsightCounts(opts.focus);
    }
    case "network_suggest": {
      return networkSuggest(focusedViewer, opts.selfUserId);
    }
    default:
      return [];
  }
};
