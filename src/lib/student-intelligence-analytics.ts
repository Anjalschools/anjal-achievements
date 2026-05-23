import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { buildShapedStages } from "@/lib/achievement-participation-focused-analytics";
import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";
import { logStudentIntelTrust, type CiObservabilityMeta } from "@/lib/competition-intelligence-debug";
import {
  buildWeightedStudentRankings,
  sortIntelRowsByWeightedScore,
} from "@/lib/analytics/achievement-ranking-engine";

const stageLabel = (key: string, loc: "ar" | "en"): string => {
  if (key === "primary") return loc === "ar" ? "ابتدائي" : "Primary";
  if (key === "middle") return loc === "ar" ? "متوسط" : "Middle";
  if (key === "secondary") return loc === "ar" ? "ثانوي" : "Secondary";
  return loc === "ar" ? "غير محدد" : "N/A";
};

export type StudentIntelRow = {
  participantId: string;
  nameAr: string;
  nameEn: string;
  avatarUrl: string;
  school: string;
  stageKey: string;
  stageLabelAr: string;
  stageLabelEn: string;
  sectionKey: string;
  mawhiba: boolean;
  recordCount: number;
  medalCount: number;
  medalRatioPct: number;
  distinctActivityCount: number;
  /** Year-over-year momentum index (records per year span); only set for `byFastestGrowth` */
  growthIndex?: number;
  yearSpan?: number;
};

export type StudentIntelligencePayload = {
  ok: true;
  generatedAt: string;
  filters: Record<string, unknown>;
  ciObservability?: CiObservabilityMeta;
  byWeightedScore: StudentIntelRow[];
  byParticipation: StudentIntelRow[];
  byMedals: StudentIntelRow[];
  bySuccessRate: StudentIntelRow[];
  byActivityDiversity: StudentIntelRow[];
  byFastestGrowth: StudentIntelRow[];
};

type AggRow = {
  _id: unknown;
  recordCount?: number;
  medalCount?: number;
  nameAr?: string;
  nameEn?: string;
  school?: string;
  stage?: string;
  section?: string;
  mawhiba?: boolean;
  avatarUrl?: string;
  distinctActivities?: unknown;
};

type GrowthAggRow = {
  _id: string;
  recordCount: number;
  medalCount: number;
  growthIndex: number;
  yearSpan: number;
};

const enrichGrowthRows = (raw: GrowthAggRow[], pools: StudentIntelRow[]): StudentIntelRow[] => {
  const map = new Map(pools.map((r) => [r.participantId, r]));
  return raw.map((g) => {
    const base = map.get(String(g._id));
    if (base) {
      return {
        ...base,
        recordCount: g.recordCount,
        medalCount: g.medalCount,
        growthIndex: g.growthIndex,
        yearSpan: g.yearSpan,
        medalRatioPct: g.recordCount > 0 ? Math.round((g.medalCount / g.recordCount) * 1000) / 10 : 0,
      };
    }
    return {
      participantId: String(g._id),
      nameAr: "—",
      nameEn: "—",
      avatarUrl: "",
      school: "—",
      stageKey: "unknown",
      stageLabelAr: "غير محدد",
      stageLabelEn: "N/A",
      sectionKey: "",
      mawhiba: false,
      recordCount: g.recordCount,
      medalCount: g.medalCount,
      medalRatioPct: g.recordCount > 0 ? Math.round((g.medalCount / g.recordCount) * 1000) / 10 : 0,
      distinctActivityCount: 0,
      growthIndex: g.growthIndex,
      yearSpan: g.yearSpan,
    };
  });
};

const toRow = (r: AggRow, distinctActivityCount = 0): StudentIntelRow => {
  const rec = Number(r.recordCount || 0);
  const med = Number(r.medalCount || 0);
  const st = String(r.stage || "unknown");
  return {
    participantId: String(r._id ?? ""),
    nameAr: String(r.nameAr || "").trim() || "—",
    nameEn: String(r.nameEn || "").trim() || "—",
    avatarUrl: r.avatarUrl ? String(r.avatarUrl).trim() : "",
    school: String(r.school || "").trim() || "—",
    stageKey: st,
    stageLabelAr: stageLabel(st, "ar"),
    stageLabelEn: stageLabel(st, "en"),
    sectionKey: String(r.section || ""),
    mawhiba: r.mawhiba === true,
    recordCount: rec,
    medalCount: med,
    medalRatioPct: rec > 0 ? Math.round((med / rec) * 1000) / 10 : 0,
    distinctActivityCount,
  };
};

export const buildStudentIntelligence = async (
  filters: ParticipationAnalyticsFilters
): Promise<StudentIntelligencePayload> => {
  await connectDB();
  const intelT0 = Date.now();
  const shaped = buildShapedStages(filters);

  const facetBody: Record<string, mongoose.PipelineStage[]> = {
    rankingPool: [
      {
        $project: {
          participantId: 1,
          resultType: 1,
          medalType: 1,
          rank: 1,
          achievementLevel: 1,
          _id: 1,
        },
      },
      { $limit: 8000 },
    ],
    byParticipation: [
      {
        $group: {
          _id: "$participantId",
          recordCount: { $sum: 1 },
          medalCount: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
          nameAr: {
            $first: {
              $ifNull: [
                "$u.fullNameAr",
                { $ifNull: ["$studentSnapshot.fullNameAr", { $ifNull: ["$u.fullName", ""] }] },
              ],
            },
          },
          nameEn: {
            $first: {
              $ifNull: [
                "$u.fullNameEn",
                { $ifNull: ["$studentSnapshot.fullNameEn", { $ifNull: ["$u.fullName", ""] }] },
              ],
            },
          },
          school: { $first: { $ifNull: ["$organization", ""] } },
          stage: { $first: "$effStage" },
          section: { $first: "$effSection" },
          mawhiba: { $first: "$effMawhiba" },
          avatarUrl: { $first: { $ifNull: ["$u.profilePhoto", ""] } },
        },
      },
      { $sort: { recordCount: -1 } },
      { $limit: 20 },
    ],
    byMedals: [
      {
        $group: {
          _id: "$participantId",
          recordCount: { $sum: 1 },
          medalCount: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
          nameAr: {
            $first: {
              $ifNull: [
                "$u.fullNameAr",
                { $ifNull: ["$studentSnapshot.fullNameAr", { $ifNull: ["$u.fullName", ""] }] },
              ],
            },
          },
          nameEn: {
            $first: {
              $ifNull: [
                "$u.fullNameEn",
                { $ifNull: ["$studentSnapshot.fullNameEn", { $ifNull: ["$u.fullName", ""] }] },
              ],
            },
          },
          school: { $first: { $ifNull: ["$organization", ""] } },
          stage: { $first: "$effStage" },
          section: { $first: "$effSection" },
          mawhiba: { $first: "$effMawhiba" },
          avatarUrl: { $first: { $ifNull: ["$u.profilePhoto", ""] } },
        },
      },
      { $sort: { medalCount: -1, recordCount: -1 } },
      { $limit: 20 },
    ],
    byFastestGrowth: [
      {
        $group: {
          _id: { p: "$participantId", y: "$effYear" },
          c: { $sum: 1 },
          m: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
        },
      },
      { $sort: { "_id.p": 1, "_id.y": 1 } },
      {
        $group: {
          _id: "$_id.p",
          points: { $push: { y: "$_id.y", c: "$c", m: "$m" } },
          recordCount: { $sum: "$c" },
          medalCount: { $sum: "$m" },
        },
      },
      {
        $addFields: {
          firstPt: { $arrayElemAt: ["$points", 0] },
          lastPt: { $arrayElemAt: ["$points", -1] },
        },
      },
      {
        $addFields: {
          yearSpan: { $subtract: ["$lastPt.y", "$firstPt.y"] },
          growthIndex: {
            $cond: [
              { $gt: [{ $subtract: ["$lastPt.y", "$firstPt.y"] }, 0] },
              {
                $divide: [
                  { $subtract: ["$lastPt.c", "$firstPt.c"] },
                  { $max: [1, { $subtract: ["$lastPt.y", "$firstPt.y"] }] },
                ],
              },
              0,
            ],
          },
        },
      },
      { $match: { yearSpan: { $gte: 1 }, growthIndex: { $gt: 0 } } },
      { $sort: { growthIndex: -1, recordCount: -1 } },
      { $limit: 20 },
    ],
    byDiversity: [
      {
        $group: {
          _id: "$participantId",
          recordCount: { $sum: 1 },
          medalCount: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
          distinctActivities: {
            $addToSet: {
              $concat: [
                { $toString: { $ifNull: ["$analyticsCategory", "$achievementType"] } },
                "\u001f",
                { $toString: "$activityRaw" },
              ],
            },
          },
          nameAr: {
            $first: {
              $ifNull: [
                "$u.fullNameAr",
                { $ifNull: ["$studentSnapshot.fullNameAr", { $ifNull: ["$u.fullName", ""] }] },
              ],
            },
          },
          nameEn: {
            $first: {
              $ifNull: [
                "$u.fullNameEn",
                { $ifNull: ["$studentSnapshot.fullNameEn", { $ifNull: ["$u.fullName", ""] }] },
              ],
            },
          },
          school: { $first: { $ifNull: ["$organization", ""] } },
          stage: { $first: "$effStage" },
          section: { $first: "$effSection" },
          mawhiba: { $first: "$effMawhiba" },
          avatarUrl: { $first: { $ifNull: ["$u.profilePhoto", ""] } },
        },
      },
      { $addFields: { divN: { $size: "$distinctActivities" } } },
      { $sort: { divN: -1, recordCount: -1 } },
      { $limit: 20 },
    ],
  };

  const [res] = await Achievement.aggregate([
    ...shaped,
    { $facet: facetBody },
  ] as mongoose.PipelineStage[]).allowDiskUse(true);

  const part = ((res?.byParticipation || []) as AggRow[]).map((r) => toRow(r, 0));
  const medals = ((res?.byMedals || []) as AggRow[]).map((r) => toRow(r, 0));

  type RankLean = {
    participantId?: unknown;
    resultType?: string;
    medalType?: string;
    rank?: string;
    achievementLevel?: string;
    _id?: unknown;
  };
  const rankPool = ((res?.rankingPool || []) as RankLean[]).map((doc) => ({
    participantId: String(doc.participantId ?? ""),
    achievementId: String(doc._id ?? ""),
    resultType: String(doc.resultType || ""),
    medalType: String(doc.medalType || ""),
    rank: String(doc.rank || ""),
    achievementLevel: String(doc.achievementLevel || ""),
  }));
  const weightedScores = buildWeightedStudentRankings(rankPool, { limit: 40 });
  const scoreById = new Map(weightedScores.map((w) => [w.participantId, w.weightedScore]));
  const metaRows = [...part, ...medals];
  const byWeightedScore = sortIntelRowsByWeightedScore(metaRows, scoreById).slice(0, 20);
  const divRaw = (res?.byDiversity || []) as Array<AggRow & { divN?: number; distinctActivities?: unknown[] }>;
  const byDiversity = divRaw.map((r) =>
    toRow(r, Array.isArray(r.distinctActivities) ? r.distinctActivities.length : Number(r.divN ?? 0))
  );

  const bySuccess = [...part]
    .filter((r) => r.recordCount >= 2)
    .sort(
      (a, b) =>
        b.medalRatioPct - a.medalRatioPct || b.medalCount - a.medalCount || b.recordCount - a.recordCount
    )
    .slice(0, 20);

  const growRaw = (res?.byFastestGrowth || []) as GrowthAggRow[];
  const byFastestGrowth = enrichGrowthRows(
    growRaw.map((x) => ({
      _id: String(x._id ?? ""),
      recordCount: Number(x.recordCount || 0),
      medalCount: Number(x.medalCount || 0),
      growthIndex: Number(x.growthIndex || 0),
      yearSpan: Number(x.yearSpan || 0),
    })),
    [...part, ...medals, ...byDiversity]
  );

  const dupParticipation = part.length - new Set(part.map((r) => r.participantId)).size;
  const dupMedals = medals.length - new Set(medals.map((r) => r.participantId)).size;
  let growthSanityFails = 0;
  for (const r of byFastestGrowth) {
    if ((r.yearSpan ?? 0) > 0 && !Number.isFinite(Number(r.growthIndex))) growthSanityFails += 1;
  }
  logStudentIntelTrust({
    duplicateIds: dupParticipation + dupMedals,
    growthSanityFails,
    durationMs: Date.now() - intelT0,
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    filters: filters as unknown as Record<string, unknown>,
    byWeightedScore: byWeightedScore.length > 0 ? byWeightedScore : part.slice(0, 20),
    byParticipation: part,
    byMedals: medals,
    bySuccessRate: bySuccess,
    byActivityDiversity: byDiversity,
    byFastestGrowth,
  };
};

export type StudentProfileTimelineRow = {
  sortDate: string;
  year: number | null;
  labelAr: string;
  labelEn: string;
  resultType: string;
  achievementType: string;
};

export type StudentProfileInsightPayload = {
  ok: true;
  participantId: string;
  generatedAt: string;
  timeline: StudentProfileTimelineRow[];
  byYear: { year: number; count: number }[];
  byResult: { key: string; count: number }[];
  ciObservability?: CiObservabilityMeta;
};

export const buildStudentProfileInsight = async (
  filters: ParticipationAnalyticsFilters,
  participantId: string
): Promise<StudentProfileInsightPayload> => {
  const pid = participantId.trim();
  const t0 = Date.now();
  const obs = (): CiObservabilityMeta => ({
    generatedAt: new Date().toISOString(),
    serverFacetMs: Date.now() - t0,
    cacheHit: false,
    cacheAgeMs: 0,
    source: "none",
    recomputeReason: "cold",
  });
  if (!pid) {
    return {
      ok: true,
      participantId: "",
      generatedAt: new Date().toISOString(),
      timeline: [],
      byYear: [],
      byResult: [],
      ciObservability: obs(),
    };
  }
  await connectDB();
  const shaped = buildShapedStages(filters);
  const matchPid: mongoose.PipelineStage = {
    $match: {
      $expr: { $eq: [{ $toString: "$participantId" }, pid] },
    },
  };

  const [doc] = await Achievement.aggregate([
    ...shaped,
    matchPid,
    {
      $facet: {
        timeline: [
          {
            $project: {
              d: { $ifNull: ["$date", "$createdAt"] },
              effYear: 1,
              resultType: { $ifNull: ["$resultType", ""] },
              achievementType: { $ifNull: ["$achievementType", ""] },
              nameAr: {
                $ifNull: [
                  "$nameAr",
                  { $ifNull: ["$achievementName", { $ifNull: ["$customAchievementName", ""] }] },
                ],
              },
              nameEn: {
                $ifNull: [
                  "$nameEn",
                  { $ifNull: ["$achievementName", { $ifNull: ["$customAchievementName", ""] }] },
                ],
              },
            },
          },
          { $sort: { d: -1 } },
          { $limit: 100 },
        ],
        byYear: [{ $group: { _id: "$effYear", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        byResult: [{ $group: { _id: "$resultType", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
      },
    },
  ] as mongoose.PipelineStage[]).allowDiskUse(true);

  if (!doc) {
    return {
      ok: true,
      participantId: pid,
      generatedAt: new Date().toISOString(),
      timeline: [],
      byYear: [],
      byResult: [],
      ciObservability: obs(),
    };
  }

  const tl = (doc.timeline || []) as Array<{
    d?: Date;
    effYear?: number;
    resultType: string;
    achievementType: string;
    nameAr: string;
    nameEn: string;
  }>;

  const timeline: StudentProfileTimelineRow[] = tl.map((t) => ({
    sortDate: t.d ? new Date(t.d).toISOString() : "",
    year: typeof t.effYear === "number" ? t.effYear : null,
    labelAr: String(t.nameAr || t.achievementType || "").trim() || "—",
    labelEn: String(t.nameEn || t.achievementType || "").trim() || "—",
    resultType: String(t.resultType || ""),
    achievementType: String(t.achievementType || ""),
  }));

  const byYear = ((doc.byYear || []) as Array<{ _id: number; count: number }>).map((y) => ({
    year: Number(y._id),
    count: Number(y.count || 0),
  }));

  const byResult = ((doc.byResult || []) as Array<{ _id: string; count: number }>).map((r) => ({
    key: String(r._id || "unknown"),
    count: Number(r.count || 0),
  }));

  return {
    ok: true,
    participantId: pid,
    generatedAt: new Date().toISOString(),
    timeline,
    byYear,
    byResult,
    ciObservability: obs(),
  };
};
