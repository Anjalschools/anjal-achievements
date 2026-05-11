import type { PipelineStage } from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniReputation from "@/models/AlumniReputation";
import AlumniStory from "@/models/AlumniStory";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniVerificationRequest from "@/models/AlumniVerificationRequest";
import type { IUser } from "@/models/User";
import type {
  AlumniReportCareerAggRow,
  AlumniReportCommunityAgg,
  AlumniReportFiltersState,
  AlumniReportKind,
  AlumniReportMeta,
  AlumniReportReputationAggRow,
  AlumniReportRow,
  AlumniReportSummary,
  AlumniReportUniversityAggRow,
  AlumniReportVerificationAgg,
} from "@/lib/alumni/alumni-report-types";
import { DEFAULT_ALUMNI_REPORT_FILTERS } from "@/lib/alumni/alumni-report-types";
import {
  buildAlumniReportPostLookupMatch,
  buildAlumniReportPreLookupMatch,
} from "@/lib/alumni/alumni-report-filters";
import { getAlumniIntelCached, setAlumniIntelCached } from "@/lib/alumni/alumni-intelligence-cache";

const META_TTL_MS = 45_000;
const SUMMARY_CACHE_TTL_MS = 30_000;

type LeanUserAgg = Record<string, unknown> & {
  _id: { toString(): string };
  repDoc?: Record<string, unknown> | null;
  verificationTicket?: { status?: string } | null;
  displayName?: string;
};

const skillsFromUser = (u: LeanUserAgg): string[] => {
  const sp = u.studentPortfolioContent as { technicalSkills?: string[] } | undefined;
  return Array.isArray(sp?.technicalSkills) ? sp!.technicalSkills! : [];
};

const serializeOverviewRow = (u: LeanUserAgg): AlumniReportRow => {
  const ap = (u.alumniProfile || {}) as NonNullable<IUser["alumniProfile"]>;
  const rep = u.repDoc || ({} as Record<string, unknown>);
  const vt = u.verificationTicket as { status?: string } | undefined;
  const memPosts = Array.isArray(ap.memoryPosts) ? ap.memoryPosts : [];
  const approvedMem = memPosts.filter((m) => m.status === "approved").length;
  const services = ap.alumniServices || {};
  const offersMent = Boolean(services.mentoring);
  const storyCount = Number(u.storyCount ?? 0);
  const storyPub = Number(u.storyPublishedCount ?? 0);
  const oppC = Number(u.opportunityCount ?? 0);
  const mentorCases = Number(u.mentorCaseCount ?? 0);

  const repScore =
    typeof rep.reputationScore === "number"
      ? rep.reputationScore
      : typeof ap.reputationScore === "number"
        ? ap.reputationScore
        : "";
  const trust = typeof ap.trustScore === "number" ? ap.trustScore : "";

  const fmtDate = (d: unknown) => {
    if (!d) return "";
    try {
      return new Date(d as string | number | Date).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  return {
    id: u._id.toString(),
    fullName: String(u.fullNameAr || u.fullNameEn || u.fullName || ""),
    email: String(u.email || ""),
    username: String(u.username || ""),
    phone: String(u.phone || ""),
    gender: String(u.gender || ""),
    graduationYear: ap.graduationYear != null ? String(ap.graduationYear) : "",
    grade: String(u.grade || ""),
    section: String(u.section || ""),
    activationStatus: String(u.alumniActivationStatus || ""),
    universityName: String(ap.universityName || ""),
    studyCountry: String(ap.studyCountry || ""),
    degree: String(ap.degree || ""),
    major: String(ap.major || ""),
    jobTitle: String(ap.currentPosition || ""),
    company: String(ap.currentCompany || ""),
    industry: String(ap.industry || ""),
    skills: skillsFromUser(u).join("، "),
    interests: Array.isArray(ap.interests) ? ap.interests.join("، ") : "",
    storyCount,
    storyPublishedCount: storyPub,
    opportunityCount: oppC,
    memoryTotalCount: memPosts.length,
    memoryApprovedCount: String(approvedMem),
    offersMentoring: offersMent ? "yes" : "no",
    mentorCases,
    reputationScore: repScore === "" ? "" : String(repScore),
    trustScore: trust === "" ? "" : String(trust),
    repBadges: Array.isArray(rep.badges) ? (rep.badges as string[]).join("، ") : Array.isArray(ap.badges) ? ap.badges.join("، ") : "",
    repTiers: Array.isArray(rep.tiers) ? (rep.tiers as string[]).join(" ← ") : "",
    networkStrength: typeof rep.networkStrengthScore === "number" ? String(rep.networkStrengthScore) : "",
    mentorshipSub: typeof rep.mentorshipScore === "number" ? String(rep.mentorshipScore) : "",
    communitySub: typeof rep.communityContributionScore === "number" ? String(rep.communityContributionScore) : "",
    careerSub: typeof rep.careerImpactScore === "number" ? String(rep.careerImpactScore) : "",
    verificationSub: typeof rep.verificationScore === "number" ? String(rep.verificationScore) : "",
    contentSub: typeof rep.contentContributionScore === "number" ? String(rep.contentContributionScore) : "",
    eventSub: typeof rep.eventParticipationScore === "number" ? String(rep.eventParticipationScore) : "",
    isVerifiedAlumni: ap.isVerifiedAlumni === true ? "yes" : "no",
    verificationTier: String(ap.verificationTier || ""),
    verificationSource: String(ap.verificationSource || ""),
    verificationTicketStatus: String(vt?.status || ""),
    lastLoginAt: fmtDate(u.lastLoginAt),
    updatedAt: fmtDate(u.updatedAt),
  };
};

const coreLookupStages: PipelineStage[] = [
  {
    $lookup: {
      from: AlumniReputation.collection.name,
      let: { uid: "$_id" },
      pipeline: [{ $match: { $expr: { $eq: ["$userId", "$$uid"] } } }, { $limit: 1 }],
      as: "rep",
    },
  },
  { $addFields: { repDoc: { $arrayElemAt: ["$rep", 0] } } },
  {
    $lookup: {
      from: AlumniStory.collection.name,
      let: { uid: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [{ $eq: ["$relatedUserId", "$$uid"] }, { $eq: ["$createdById", "$$uid"] }],
            },
          },
        },
        {
          $group: {
            _id: null,
            all: { $sum: 1 },
            pub: { $sum: { $cond: [{ $eq: ["$published", true] }, 1, 0] } },
          },
        },
      ],
      as: "stAgg",
    },
  },
  {
    $addFields: {
      storyCount: { $ifNull: [{ $arrayElemAt: ["$stAgg.all", 0] }, 0] },
      storyPublishedCount: { $ifNull: [{ $arrayElemAt: ["$stAgg.pub", 0] }, 0] },
    },
  },
  {
    $lookup: {
      from: AlumniOpportunity.collection.name,
      let: { uid: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$createdByUserId", "$$uid"] } } },
        { $count: "c" },
      ],
      as: "opAgg",
    },
  },
  { $addFields: { opportunityCount: { $ifNull: [{ $arrayElemAt: ["$opAgg.c", 0] }, 0] } } },
  {
    $lookup: {
      from: AlumniMentorshipRequest.collection.name,
      let: { uid: "$_id" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [{ $eq: ["$mentorId", "$$uid"] }, { $in: ["$status", ["pending", "accepted", "completed"]] }],
            },
          },
        },
        { $count: "c" },
      ],
      as: "menAgg",
    },
  },
  { $addFields: { mentorCaseCount: { $ifNull: [{ $arrayElemAt: ["$menAgg.c", 0] }, 0] } } },
  {
    $lookup: {
      from: AlumniVerificationRequest.collection.name,
      let: { uid: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$userId", "$$uid"] } } },
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        { $project: { status: 1, requestedLevel: 1 } },
      ],
      as: "vr",
    },
  },
  { $addFields: { verificationTicket: { $arrayElemAt: ["$vr", 0] } } },
  {
    $addFields: {
      memoryApprovedCount: {
        $size: {
          $filter: {
            input: { $ifNull: ["$alumniProfile.memoryPosts", []] },
            as: "m",
            cond: { $eq: ["$$m.status", "approved"] },
          },
        },
      },
      offersMentoringFlag: { $eq: ["$alumniProfile.alumniServices.mentoring", true] },
    },
  },
];

const buildFilteredPipeline = (f: AlumniReportFiltersState): PipelineStage[] => {
  const pre = buildAlumniReportPreLookupMatch(f);
  const post = buildAlumniReportPostLookupMatch(f);
  const stages: PipelineStage[] = [{ $match: pre }, ...coreLookupStages];
  if (post) stages.push({ $match: post });
  return stages;
};

const cacheKeyForSummary = (f: AlumniReportFiltersState) =>
  `alumni-reports:summary:${JSON.stringify(f)}`;

export const getAlumniReportMeta = async (): Promise<AlumniReportMeta> => {
  const key = "alumni-reports:meta:v1";
  const hit = getAlumniIntelCached<AlumniReportMeta>(key);
  if (hit) return hit;

  await connectDB();
  const active = buildAlumniReportPreLookupMatch(DEFAULT_ALUMNI_REPORT_FILTERS());

  const [graduationYears, universities, studyCountries, majors, currentCountries, industries] = await Promise.all([
    User.distinct("alumniProfile.graduationYear", active).then((arr) =>
      (arr as number[]).filter((n) => typeof n === "number" && Number.isFinite(n)).sort((a, b) => b - a)
    ),
    User.distinct("alumniProfile.universityName", active).then((arr) =>
      (arr as string[]).filter((s) => s && String(s).trim()).sort()
    ),
    User.distinct("alumniProfile.studyCountry", active).then((arr) =>
      (arr as string[]).filter((s) => s && String(s).trim()).sort()
    ),
    User.distinct("alumniProfile.major", active).then((arr) =>
      (arr as string[]).filter((s) => s && String(s).trim()).sort()
    ),
    User.distinct("alumniProfile.country", active).then((arr) =>
      (arr as string[]).filter((s) => s && String(s).trim()).sort()
    ),
    User.distinct("alumniProfile.industry", active).then((arr) =>
      (arr as string[]).filter((s) => s && String(s).trim()).sort()
    ),
  ]);

  const meta: AlumniReportMeta = {
    graduationYears: graduationYears.slice(0, 80),
    universities: universities.slice(0, 400),
    studyCountries: studyCountries.slice(0, 200),
    majors: majors.slice(0, 400),
    currentCountries: currentCountries.slice(0, 200),
    industries: industries.slice(0, 200),
  };
  setAlumniIntelCached(key, meta, META_TTL_MS);
  return meta;
};

const computeSummaryFromFacet = (raw: Record<string, unknown>): AlumniReportSummary => {
  const alumniCount = Number((raw.alumniCount as number) || 0);
  const distinctUniversities = Number((raw.distinctUniversities as number) || 0);
  const distinctCountries = Number((raw.distinctCountries as number) || 0);
  const mentorsOffering = Number((raw.mentorsOffering as number) || 0);
  const opportunityRows = Number((raw.opportunityRows as number) || 0);
  const storyCount = Number((raw.storyCount as number) || 0);
  const memoryApproved = Number((raw.memoryApproved as number) || 0);
  const avgReputation = raw.avgReputation != null ? String(Number(raw.avgReputation).toFixed(1)) : "—";
  const topCohort = (raw.topCohort as { y?: number; c?: number }) || {};
  const topUni = (raw.topUniversity as { n?: string; c?: number }) || {};
  return {
    alumniCount,
    distinctUniversities,
    distinctCountries,
    mentorsOffering,
    opportunityRows,
    storyCount,
    memoryApproved,
    avgReputation,
    topCohortYear: topCohort.y != null ? String(topCohort.y) : "—",
    topUniversity: topUni.n ? `${topUni.n} (${topUni.c ?? 0})` : "—",
  };
};

export const runAlumniOverviewReport = async (args: {
  filters: AlumniReportFiltersState;
  page: number;
  pageSize: number;
}): Promise<{
  rows: AlumniReportRow[];
  total: number;
  summary: AlumniReportSummary;
}> => {
  await connectDB();
  const { filters, page, pageSize } = args;
  const skip = Math.max(0, (page - 1) * pageSize);
  const limit = Math.min(100, Math.max(1, pageSize));

  const pipe = buildFilteredPipeline(filters);

  const summaryKey = cacheKeyForSummary(filters);
  const cachedSummary = getAlumniIntelCached<AlumniReportSummary>(summaryKey);

  const facetStage: PipelineStage = {
    $facet: {
      total: [{ $count: "c" }],
      data: [
        { $sort: { updatedAt: -1 as const } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            fullName: 1,
            fullNameAr: 1,
            fullNameEn: 1,
            email: 1,
            username: 1,
            phone: 1,
            gender: 1,
            grade: 1,
            section: 1,
            alumniActivationStatus: 1,
            alumniProfile: 1,
            studentPortfolioContent: 1,
            lastLoginAt: 1,
            updatedAt: 1,
            repDoc: 1,
            verificationTicket: 1,
            storyCount: 1,
            storyPublishedCount: 1,
            opportunityCount: 1,
            mentorCaseCount: 1,
          },
        },
      ],
      summaryUniversities: [
        {
          $group: {
            _id: "$alumniProfile.universityName",
            c: { $sum: 1 },
          },
        },
        { $match: { _id: { $nin: [null, ""] } } },
        { $sort: { c: -1 } },
        { $limit: 1 },
      ],
      summaryCohort: [
        {
          $group: {
            _id: "$alumniProfile.graduationYear",
            c: { $sum: 1 },
          },
        },
        { $match: { _id: { $type: "number" } } },
        { $sort: { c: -1 } },
        { $limit: 1 },
      ],
      summaryStats: [
        {
          $group: {
            _id: null,
            alumniCount: { $sum: 1 },
            distinctUniversities: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$alumniProfile.universityName", null] },
                      { $ne: ["$alumniProfile.universityName", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            distinctCountries: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$alumniProfile.country", null] },
                      { $ne: ["$alumniProfile.country", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            mentorsOffering: {
              $sum: {
                $cond: [
                  {
                    $or: [{ $eq: ["$offersMentoringFlag", true] }, { $gt: ["$mentorCaseCount", 0] }],
                  },
                  1,
                  0,
                ],
              },
            },
            opportunityRows: { $sum: "$opportunityCount" },
            storyCount: { $sum: "$storyCount" },
            memoryApproved: { $sum: "$memoryApprovedCount" },
            avgReputation: { $avg: "$repDoc.reputationScore" },
          },
        },
      ],
    },
  };

  const agg = await User.aggregate<Record<string, unknown>>([...pipe, facetStage]);
  const bucket = agg[0] || {};
  const totalArr = (bucket.total as { c: number }[]) || [];
  const total = totalArr[0]?.c ?? 0;
  const data = (bucket.data as LeanUserAgg[]) || [];

  let summary: AlumniReportSummary;
  if (cachedSummary) {
    summary = cachedSummary;
  } else {
    const su = ((bucket.summaryUniversities as { _id: string; c: number }[]) || [])[0];
    const sc = ((bucket.summaryCohort as { _id: number; c: number }[]) || [])[0];
    const ss = ((bucket.summaryStats as Record<string, number>[]) || [])[0] || {};
    const distinctUniversitiesAgg = await User.aggregate<{ c: number }>([
      ...pipe,
      { $group: { _id: "$alumniProfile.universityName" } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $count: "c" },
    ]);
    const distinctCountriesAgg = await User.aggregate<{ c: number }>([
      ...pipe,
      { $group: { _id: "$alumniProfile.country" } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $count: "c" },
    ]);
    summary = computeSummaryFromFacet({
      ...ss,
      distinctUniversities: distinctUniversitiesAgg[0]?.c ?? 0,
      distinctCountries: distinctCountriesAgg[0]?.c ?? 0,
      topUniversity: { n: su?._id, c: su?.c },
      topCohort: { y: sc?._id, c: sc?.c },
    });
    setAlumniIntelCached(summaryKey, summary, SUMMARY_CACHE_TTL_MS);
  }

  return {
    rows: data.map(serializeOverviewRow),
    total,
    summary,
  };
};

export const runAlumniUniversitiesReport = async (
  filters: AlumniReportFiltersState
): Promise<{ rows: AlumniReportUniversityAggRow[] }> => {
  await connectDB();
  const pipe = buildFilteredPipeline(filters);
  const rows = await User.aggregate<{ _id: string; c: number; v: number; sc: string; mj: string }>([
    ...pipe,
    {
      $group: {
        _id: "$alumniProfile.universityName",
        c: { $sum: 1 },
        v: { $sum: { $cond: [{ $eq: ["$alumniProfile.isVerifiedAlumni", true] }, 1, 0] } },
        studyCountries: { $addToSet: "$alumniProfile.studyCountry" },
        majors: { $addToSet: "$alumniProfile.major" },
      },
    },
    { $match: { _id: { $nin: [null, ""] } } },
    { $sort: { c: -1 } },
    { $limit: 200 },
    {
      $project: {
        _id: 1,
        c: 1,
        v: 1,
        sc: { $arrayElemAt: ["$studyCountries", 0] },
        mj: { $arrayElemAt: ["$majors", 0] },
      },
    },
  ]);
  return {
    rows: rows.map((r) => ({
      universityName: String(r._id),
      alumniCount: r.c,
      verifiedCount: r.v,
      topStudyCountry: String(r.sc || ""),
      topMajor: String(r.mj || ""),
    })),
  };
};

export const runAlumniCareersReport = async (
  filters: AlumniReportFiltersState
): Promise<{ rows: AlumniReportCareerAggRow[] }> => {
  await connectDB();
  const pipe = buildFilteredPipeline(filters);
  const rows = await User.aggregate<{ _id: { ind: string; pos: string }; c: number; avg: number | null }>([
    ...pipe,
    {
      $group: {
        _id: { ind: "$alumniProfile.industry", pos: "$alumniProfile.currentPosition" },
        c: { $sum: 1 },
        avg: { $avg: "$repDoc.reputationScore" },
      },
    },
    { $match: { "_id.ind": { $nin: [null, ""] } } },
    { $sort: { c: -1 } },
    { $limit: 200 },
  ]);
  return {
    rows: rows.map((r) => ({
      industry: String(r._id.ind || ""),
      position: String(r._id.pos || ""),
      count: r.c,
      avgReputation: r.avg != null && Number.isFinite(r.avg) ? r.avg.toFixed(1) : "—",
    })),
  };
};

export const runAlumniCommunityReport = async (
  filters: AlumniReportFiltersState
): Promise<{ data: AlumniReportCommunityAgg }> => {
  await connectDB();
  const pipe = buildFilteredPipeline(filters);
  const [totals, topAuthors, mentorshipRequestsTotal] = await Promise.all([
    User.aggregate<Record<string, number>>([
      ...pipe,
      {
        $group: {
          _id: null,
          storiesTotal: { $sum: "$storyCount" },
          storiesPublished: { $sum: "$storyPublishedCount" },
          opportunitiesByUser: { $sum: "$opportunityCount" },
          memoryPostsTotal: { $sum: { $size: { $ifNull: ["$alumniProfile.memoryPosts", []] } } },
          memoryPostsApproved: { $sum: "$memoryApprovedCount" },
        },
      },
    ]),
    User.aggregate<{ _id: { toString(): string }; displayName: string; storyCount: number }>([
      ...pipe,
      { $match: { storyCount: { $gt: 0 } } },
      {
        $project: {
          _id: 1,
          displayName: { $ifNull: ["$fullNameAr", { $ifNull: ["$fullNameEn", "$fullName"] }] },
          storyCount: 1,
        },
      },
      { $sort: { storyCount: -1 } },
      { $limit: 12 },
    ]),
    AlumniMentorshipRequest.countDocuments({}),
  ]);

  const t = totals[0] || {};
  const data: AlumniReportCommunityAgg = {
    storiesTotal: Number(t.storiesTotal || 0),
    storiesPublished: Number(t.storiesPublished || 0),
    opportunitiesByUser: Number(t.opportunitiesByUser || 0),
    memoryPostsTotal: Number(t.memoryPostsTotal || 0),
    memoryPostsApproved: Number(t.memoryPostsApproved || 0),
    mentorshipRequestsTotal,
    topStoryAuthors: topAuthors.map((r) => ({
      userId: r._id.toString(),
      name: String(r.displayName || ""),
      count: Number(r.storyCount || 0),
    })),
  };
  return { data };
};

export const runAlumniVerificationReport = async (
  filters: AlumniReportFiltersState
): Promise<{ data: AlumniReportVerificationAgg }> => {
  await connectDB();
  const pipe = buildFilteredPipeline(filters);
  const [profile, tickets, bySource, byTier] = await Promise.all([
    User.aggregate<{ pv: number; pu: number }>([
      ...pipe,
      {
        $group: {
          _id: null,
          pv: { $sum: { $cond: [{ $eq: ["$alumniProfile.isVerifiedAlumni", true] }, 1, 0] } },
          pu: { $sum: { $cond: [{ $ne: ["$alumniProfile.isVerifiedAlumni", true] }, 1, 0] } },
        },
      },
    ]),
    User.aggregate<{ _id: string; c: number }>([
      ...pipe,
      { $match: { verificationTicket: { $ne: null } } },
      { $group: { _id: "$verificationTicket.status", c: { $sum: 1 } } },
    ]),
    User.aggregate<{ _id: string; c: number }>([
      ...pipe,
      { $match: { "alumniProfile.verificationSource": { $nin: [null, ""] } } },
      { $group: { _id: "$alumniProfile.verificationSource", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
    ]),
    User.aggregate<{ _id: string; c: number }>([
      ...pipe,
      { $match: { "alumniProfile.verificationTier": { $nin: [null, ""] } } },
      { $group: { _id: "$alumniProfile.verificationTier", c: { $sum: 1 } } },
      { $sort: { c: -1 } },
    ]),
  ]);

  const p = profile[0] || { pv: 0, pu: 0 };
  const ticketMap = Object.fromEntries(tickets.map((x) => [String(x._id || ""), x.c]));
  return {
    data: {
      profileVerified: Number(p.pv || 0),
      profileUnverified: Number(p.pu || 0),
      ticketsPending: Number(ticketMap.pending || 0),
      ticketsApproved: Number(ticketMap.approved || 0),
      ticketsRejected: Number(ticketMap.rejected || 0),
      bySource: bySource.map((r) => ({ source: String(r._id), count: r.c })),
      byTier: byTier.map((r) => ({ tier: String(r._id), count: r.c })),
    },
  };
};

export const runAlumniReputationReport = async (
  filters: AlumniReportFiltersState,
  page: number,
  pageSize: number
): Promise<{ rows: AlumniReportReputationAggRow[]; total: number }> => {
  await connectDB();
  const pipe = buildFilteredPipeline(filters);
  const skip = Math.max(0, (page - 1) * pageSize);
  const limit = Math.min(100, Math.max(1, pageSize));

  const facet = await User.aggregate<{
    total: { c: number }[];
    data: LeanUserAgg[];
  }>([
    ...pipe,
    { $match: { repDoc: { $ne: null } } },
    {
      $facet: {
        total: [{ $count: "c" }],
        data: [
          { $sort: { "repDoc.reputationScore": -1 as const } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              email: 1,
              displayName: { $ifNull: ["$fullNameAr", { $ifNull: ["$fullNameEn", "$fullName"] }] },
              repDoc: 1,
              alumniProfile: 1,
            },
          },
        ],
      },
    },
  ]);

  const b = facet[0] || { total: [], data: [] };
  const total = b.total[0]?.c ?? 0;
  const rows: AlumniReportReputationAggRow[] = (b.data || []).map((u) => {
    const rep = u.repDoc || {};
    const ap = (u.alumniProfile || {}) as NonNullable<IUser["alumniProfile"]>;
    return {
      userId: u._id.toString(),
      fullName: String(u.displayName || u.fullName || ""),
      email: String(u.email || ""),
      reputationScore: typeof rep.reputationScore === "number" ? rep.reputationScore : 0,
      trustScore: ap.trustScore != null ? String(ap.trustScore) : "",
      badges: Array.isArray(rep.badges) ? (rep.badges as string[]).join("، ") : "",
      tiers: Array.isArray(rep.tiers) ? (rep.tiers as string[]).join(" ← ") : "",
      networkStrength: typeof rep.networkStrengthScore === "number" ? rep.networkStrengthScore : 0,
    };
  });
  return { rows, total };
};

export const runAlumniReport = async (input: {
  kind: AlumniReportKind;
  filters: AlumniReportFiltersState;
  page: number;
  pageSize: number;
}): Promise<Record<string, unknown>> => {
  const { kind, filters, page, pageSize } = input;
  if (kind === "overview") {
    const { rows, total, summary } = await runAlumniOverviewReport({ filters, page, pageSize });
    return { kind, rows, total, summary, page, pageSize };
  }
  if (kind === "universities") {
    const { rows } = await runAlumniUniversitiesReport(filters);
    return { kind, rows, total: rows.length, page: 1, pageSize: rows.length };
  }
  if (kind === "careers") {
    const { rows } = await runAlumniCareersReport(filters);
    return { kind, rows, total: rows.length, page: 1, pageSize: rows.length };
  }
  if (kind === "community") {
    const { data } = await runAlumniCommunityReport(filters);
    return { kind, data, total: 0, page: 1, pageSize: 0 };
  }
  if (kind === "verification") {
    const { data } = await runAlumniVerificationReport(filters);
    return { kind, data, total: 0, page: 1, pageSize: 0 };
  }
  if (kind === "reputation") {
    const { rows, total } = await runAlumniReputationReport(filters, page, pageSize);
    return { kind, rows, total, page, pageSize };
  }
  return { kind: "overview", rows: [], total: 0, summary: null, page, pageSize };
};
