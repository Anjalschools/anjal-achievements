import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import type { AdminReportFilters } from "@/lib/achievement-admin-reports";
import {
  getAchievementLevelLabel,
} from "@/lib/achievementDisplay";
import { resolveAchievementOutcome } from "@/lib/analytics/achievement-outcome-resolver";
import { getDbAchievementTypeLabel } from "@/lib/achievement-labels";
import {
  parseReportCsvParam,
  resultTokenToMongoCondition,
  REPORT_LEVEL_VALUES,
  REPORT_RESULT_TOKEN_VALUES,
} from "@/lib/report-filter-options";
import {
  buildReportCategoriesMongoFilter,
  EXTENDED_REPORT_CATEGORY_SET,
} from "@/lib/achievement-report-category";
import { resolveAchievementActivityName } from "@/lib/resolve-achievement-activity-name";
import { formatAchievementClassificationLabel } from "@/lib/admin-achievement-labels";
import type { CiObservabilityMeta } from "@/lib/competition-intelligence-debug";
import { mongoAnalyticsCategoryAddFields } from "@/lib/analytics/mongo-analytics-category";
import {
  buildMultiFilterMongoQuery,
  deserializeMultiFilter,
  deserializeMultiFilterWithLegacy,
  normalizeNumericMultiFilter,
  resolveReportMultiFilters,
} from "@/lib/analytics/multi-filter-utils";

const ALLOW_CATEGORY = EXTENDED_REPORT_CATEGORY_SET;
const ALLOW_PRIMARY_TYPE = ALLOW_CATEGORY;
const ALLOW_LEVEL = new Set<string>([...REPORT_LEVEL_VALUES]);
const ALLOW_RESULT = new Set<string>(REPORT_RESULT_TOKEN_VALUES);

const GRADES_BY_STAGE: Record<string, string[]> = {
  primary: ["g1", "g2", "g3", "g4", "g5", "g6"],
  middle: ["g7", "g8", "g9"],
  secondary: ["g10", "g11", "g12"],
};

const parseDate = (v: unknown): Date | null => {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseAcademicYears = (s: string | undefined): number[] | null => {
  if (!s || !s.trim()) return null;
  const years = [...s.matchAll(/20\d{2}/g)].map((m) => parseInt(m[0], 10));
  if (years.length >= 2) return [...new Set(years)].sort((a, b) => a - b);
  if (years.length === 1) return [years[0]];
  return null;
};

const normalizeCategories = (f: AdminReportFilters): string[] => {
  const raw =
    f.categories && f.categories.length > 0
      ? f.categories
      : f.category && f.category !== "all"
        ? [f.category]
        : [];
  return raw.map((x) => String(x).trim()).filter((x) => ALLOW_CATEGORY.has(x));
};

const normalizeLevels = (f: AdminReportFilters): string[] => {
  const raw =
    f.levels && f.levels.length > 0 ? f.levels : f.level && f.level !== "all" ? [f.level] : [];
  return raw.map((x) => String(x).trim()).filter((x) => ALLOW_LEVEL.has(x));
};

const normalizeResultTokens = (f: AdminReportFilters): string[] => {
  const raw =
    f.resultTokens && f.resultTokens.length > 0
      ? f.resultTokens
      : f.result && f.result !== "all"
        ? [f.result]
        : [];
  return raw.map((x) => String(x).trim()).filter((x) => ALLOW_RESULT.has(x));
};

export type ParticipationAnalyticsFilters = AdminReportFilters & {
  /** arabic | international | all */
  section?: string;
  /** achievement.domain or free text */
  domain?: string;
  /** achievementClassification exact or contains */
  classification?: string;
  /** Regex on achievement.organization */
  organization?: string;
  /** achievementYear (single) — overrides academicYear if set */
  achievementYear?: number;
  /**
   * Narrow to one high-level DB category/type (competition, program, …).
   * Uses the same allowlist as achievement reports (`REPORT_CATEGORY_VALUES`).
   */
  primaryAchievementType?: string;
  /**
   * Drill-down to one aggregated activity bucket (must match pipeline `achievementType` + `activityRaw`).
   */
  activityFocusType?: string;
  /** Paired with `activityFocusType`; use exact string from `activityOptions[].rawKey` */
  activityFocusRaw?: string;
};

export type ParticipationActivityRow = {
  activityKey: string;
  activityLabelAr: string;
  activityLabelEn: string;
  typeKey: string;
  typeLabelAr: string;
  typeLabelEn: string;
  classificationKey: string;
  classificationLabelAr: string;
  classificationLabelEn: string;
  levelKey: string;
  levelLabelAr: string;
  levelLabelEn: string;
  participationResultKey: string;
  participationResultAr: string;
  participationResultEn: string;
  totalParticipations: number;
  distinctParticipants: number;
  maleParticipants: number;
  femaleParticipants: number;
  arabicParticipants: number;
  internationalParticipants: number;
  mawhibaParticipants: number;
  nonMawhibaParticipants: number;
  goldMedalCount: number;
  silverMedalCount: number;
  bronzeMedalCount: number;
  rankCount: number;
  nominationCount: number;
  participationOnlyCount: number;
  approvedAchievements: number;
  excellenceRatePct: number;
};

export type ParticipationAnalyticsPayload = {
  ok: true;
  generatedAt: string;
  filters: ParticipationAnalyticsFilters;
  /** Optional server/cache timing — clients may ignore. */
  ciObservability?: CiObservabilityMeta;
  kpis: {
    totalParticipations: number;
    distinctStudents: number;
    mawhibaParticipationPct: number;
    femalePct: number;
    internationalSectionPct: number;
    activeProgramsCount: number;
    topProgramLabelAr: string;
    topProgramLabelEn: string;
    topSectionLabelAr: string;
    topSectionLabelEn: string;
    goldMedalCount: number;
    firstPlaceCount: number;
    nominationCount: number;
    highestLevelLabelAr: string;
    highestLevelLabelEn: string;
    internationalAchievementPct: number;
    globalAchievementPct: number;
  };
  charts: {
    genderParticipation: { key: string; labelAr: string; labelEn: string; count: number }[];
    sectionParticipation: { key: string; labelAr: string; labelEn: string; count: number }[];
    mawhibaSplit: { key: string; labelAr: string; labelEn: string; count: number }[];
    resultDistribution: { labelAr: string; labelEn: string; count: number }[];
    levelDistribution: { labelAr: string; labelEn: string; count: number }[];
    genderResultStack: { gender: string; labelAr: string; labelEn: string; gold: number; silver: number; bronze: number; ranks: number }[];
    topPrograms: { labelAr: string; labelEn: string; studentCount: number; rows: number }[];
    activityHorizontal: { labelAr: string; labelEn: string; studentCount: number }[];
    /** Gold / silver / bronze / nomination / rank / participation counts for the current filter scope */
    resultOutcomeCompare: {
      key: string;
      labelAr: string;
      labelEn: string;
      count: number;
      color: string;
    }[];
    /** Year-over-year trend when `achievementYear` / dates allow */
    yearTrend: {
      year: number;
      totalRows: number;
      distinctStudents: number;
      goldMedals: number;
    }[];
  };
  /** Distinct real activities for cascading filters (server-side capped) */
  activityOptions: {
    typeKey: string;
    rawKey: string;
    count: number;
    labelAr: string;
    labelEn: string;
  }[];
  /** Present when `focusType` + `focusRaw` narrow to one activity bucket */
  focusedActivity: { typeKey: string; rawKey: string; labelAr: string; labelEn: string } | null;
  table: ParticipationActivityRow[];
  tableTotal: number;
  page: number;
  pageSize: number;
};

const levelKeyFromMaxRank = (maxRank: number): string => {
  if (maxRank >= 7) return "global";
  if (maxRank === 6) return "international";
  if (maxRank === 5) return "kingdom";
  if (maxRank === 3) return "province";
  return "school";
};

const buildParticipationMongoMatch = (filters: ParticipationAnalyticsFilters): Record<string, unknown> => {
  const query: Record<string, unknown> = {};
  const rootAnd: Record<string, unknown>[] = [];

  const levels = normalizeLevels(filters);
  if (levels.length === 1) query.achievementLevel = levels[0];
  else if (levels.length > 1) query.achievementLevel = { $in: levels };

  const multi = resolveReportMultiFilters(filters);

  const statusMongo = buildMultiFilterMongoQuery("status", multi.statuses);
  if (statusMongo) Object.assign(query, statusMongo);

  if (multi.certificateStatuses.length === 1) {
    if (multi.certificateStatuses[0] === "issued") query.certificateIssued = true;
    if (multi.certificateStatuses[0] === "not_issued") query.certificateIssued = { $ne: true };
  } else if (multi.certificateStatuses.length > 1) {
    const wantIssued = multi.certificateStatuses.includes("issued");
    const wantNot = multi.certificateStatuses.includes("not_issued");
    if (wantIssued !== wantNot) {
      if (wantIssued) query.certificateIssued = true;
      else query.certificateIssued = { $ne: true };
    }
  }

  if (multi.achievementNames.length === 1) {
    const esc = multi.achievementNames[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.achievementName = new RegExp(`^${esc}$`, "i");
  } else if (multi.achievementNames.length > 1) {
    rootAnd.push({
      $or: multi.achievementNames.map((n) => {
        const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return { achievementName: new RegExp(`^${esc}$`, "i") };
      }),
    });
  } else if (filters.achievementName && filters.achievementName !== "all") {
    const esc = String(filters.achievementName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.achievementName = new RegExp(`^${esc}$`, "i");
  }

  const categories = normalizeCategories(filters);
  const categoryFilter = buildReportCategoriesMongoFilter(categories);
  if (categoryFilter) rootAnd.push(categoryFilter);

  const primary = String(filters.primaryAchievementType || "").trim();
  if (primary && primary !== "all" && ALLOW_PRIMARY_TYPE.has(primary)) {
    const primaryFilter = buildReportCategoriesMongoFilter([primary]);
    if (primaryFilter) rootAnd.push(primaryFilter);
  }

  const resultTokens = normalizeResultTokens(filters);
  const resultConds = resultTokens
    .map((t) => resultTokenToMongoCondition(t))
    .filter((c): c is Record<string, unknown> => c != null);
  if (resultConds.length === 1) rootAnd.push(resultConds[0]);
  else if (resultConds.length > 1) rootAnd.push({ $or: resultConds });

  const domain = String(filters.domain || "").trim();
  if (domain) {
    const rx = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    rootAnd.push({
      $or: [{ domain: rx }, { achievementName: rx }, { inferredField: rx }],
    });
  }

  const cls = String(filters.classification || "").trim();
  if (cls) {
    query.achievementClassification = cls.includes("*")
      ? new RegExp(cls.replace(/\*/g, ".*"), "i")
      : cls;
  }

  const org = String(filters.organization || "").trim();
  if (org) {
    query.organization = new RegExp(org.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }

  const from = parseDate(filters.fromDate);
  const to = parseDate(filters.toDate);
  if (from || to) {
    query.date = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const yearFromParam =
    typeof filters.achievementYear === "number" && Number.isFinite(filters.achievementYear)
      ? [filters.achievementYear]
      : null;
  const yearsFromAcademic = parseAcademicYears(filters.academicYear);
  const years = yearFromParam ?? yearsFromAcademic;
  if (years && years.length > 0) {
    query.achievementYear = years.length > 1 ? { $in: years } : years[0];
  }

  if (rootAnd.length === 1) {
    Object.assign(query, rootAnd[0]);
  } else if (rootAnd.length > 1) {
    query.$and = rootAnd;
  }

  return query;
};

const dominantResultFromCombos = (
  combos: Array<{ rt?: string; mt?: string; rk?: string }>,
  loc: "ar" | "en"
): { key: string; label: string } => {
  const counts = new Map<string, number>();
  for (const c of combos) {
    const rt = String(c.rt || "");
    const mt = String(c.mt || "");
    const rk = String(c.rk || "");
    const k = `${rt}|${mt}|${rk}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let bestKey = "";
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestKey = k;
    }
  }
  if (!bestKey) return { key: "", label: loc === "ar" ? "غير محدد" : "Not specified" };
  const [rt, mt, rk] = bestKey.split("|");
  const outcome = resolveAchievementOutcome({
    resultType: rt,
    medalType: mt,
    rank: rk,
  });
  const label = loc === "ar" ? outcome.displayAr : outcome.displayEn;
  return { key: outcome.outcomeKey || bestKey, label };
};

export const buildParticipationAnalytics = async (input: {
  filters: ParticipationAnalyticsFilters;
  page?: number;
  pageSize?: number;
}): Promise<ParticipationAnalyticsPayload> => {
  await connectDB();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, input.pageSize ?? 25));
  const filters = input.filters;

  const baseMatch = buildParticipationMongoMatch(filters);

  const postStages: mongoose.PipelineStage[] = [];

  const multi = resolveReportMultiFilters(filters);

  if (multi.stages.length > 0) {
    const stageGrades = multi.stages.flatMap((s) => GRADES_BY_STAGE[s] || []);
    if (stageGrades.length > 0) {
      postStages.push({ $match: { effGrade: { $in: stageGrades } } });
    }
  } else {
    const stage = String(filters.stage || "").trim();
    if (stage !== "all" && stage && GRADES_BY_STAGE[stage]) {
      postStages.push({ $match: { effGrade: { $in: GRADES_BY_STAGE[stage] } } });
    }
  }

  if (multi.grades.length > 0) {
    postStages.push({ $match: { effGrade: { $in: multi.grades.map((g) => g.toLowerCase()) } } });
  } else {
    const grade = String(filters.grade || "").trim();
    if (grade && grade !== "all") {
      postStages.push({ $match: { effGrade: grade.toLowerCase() } });
    }
  }

  if (multi.genders.length > 0) {
    postStages.push({ $match: { effGender: { $in: multi.genders } } });
  } else {
    const gender = String(filters.gender || "").trim();
    if (gender && gender !== "all") {
      postStages.push({ $match: { effGender: gender } });
    }
  }
  const section = String(filters.section || "").trim();
  if (section && section !== "all") {
    postStages.push({ $match: { effSection: section } });
  }
  if (multi.mawhibaValues.length > 0) {
    const wantYes = multi.mawhibaValues.includes("yes");
    const wantNo = multi.mawhibaValues.includes("no");
    if (wantYes !== wantNo) {
      if (wantYes) postStages.push({ $match: { effMawhiba: true } });
      if (wantNo) postStages.push({ $match: { effMawhiba: { $ne: true } } });
    }
  } else {
    const mh = String(filters.mawhiba || "").trim();
    if (mh === "yes") postStages.push({ $match: { effMawhiba: true } });
    if (mh === "no") postStages.push({ $match: { effMawhiba: { $ne: true } } });
  }

  const shapedPipeline: mongoose.PipelineStage[] = [
    { $match: baseMatch },
    {
      $lookup: {
        from: "users",
        let: { uid: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
          { $project: { gender: 1, section: 1, isMawhibaStudent: 1, grade: 1, fullName: 1, fullNameAr: 1, fullNameEn: 1 } },
        ],
        as: "_uwrap",
      },
    },
    { $addFields: { u: { $first: "$_uwrap" } } },
    {
      $addFields: {
        effGrade: {
          $toLower: {
            $trim: {
              input: { $ifNull: ["$u.grade", { $ifNull: ["$studentSnapshot.grade", ""] }] },
            },
          },
        },
        effGenderRaw: {
          $toLower: {
            $trim: {
              input: { $ifNull: ["$u.gender", { $ifNull: ["$studentSnapshot.gender", "male"] }] },
            },
          },
        },
        effSectionRaw: {
          $toLower: {
            $trim: {
              input: { $ifNull: ["$u.section", { $ifNull: ["$studentSnapshot.section", "arabic"] }] },
            },
          },
        },
        effMawhiba: {
          $cond: {
            if: { $eq: [{ $type: "$u.isMawhibaStudent" }, "bool"] },
            then: "$u.isMawhibaStudent",
            else: { $eq: [{ $ifNull: ["$studentSnapshot.isMawhibaStudent", false] }, true] },
          },
        },
        participantId: {
          $ifNull: ["$userId", { $ifNull: ["$studentProfileKey", "$_id"] }],
        },
        legacyL: { $toLower: { $ifNull: ["$level", ""] } },
        activityRaw: {
          $switch: {
            branches: [
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$customAchievementName", ""] } }, 0] },
                then: "$customAchievementName",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$achievementName", ""] } }, 0] },
                then: "$achievementName",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$inferredField", ""] } }, 0] },
                then: "$inferredField",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$customProgramName", ""] } }, 0] },
                then: "$customProgramName",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$programName", ""] } }, 0] },
                then: "$programName",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$customCompetitionName", ""] } }, 0] },
                then: "$customCompetitionName",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$competitionName", ""] } }, 0] },
                then: "$competitionName",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$exhibitionName", ""] } }, 0] },
                then: "$exhibitionName",
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$customExhibitionName", ""] } }, 0] },
                then: "$customExhibitionName",
              },
              {
                case: {
                  $or: [
                    { $gt: [{ $strLenCP: { $ifNull: ["$olympiadMeeting", ""] } }, 0] },
                    { $gt: [{ $strLenCP: { $ifNull: ["$olympiadField", ""] } }, 0] },
                  ],
                },
                then: {
                  $trim: {
                    input: {
                      $concat: [
                        { $ifNull: ["$olympiadMeeting", ""] },
                        {
                          $cond: [
                            {
                              $and: [
                                { $gt: [{ $strLenCP: { $ifNull: ["$olympiadMeeting", ""] } }, 0] },
                                { $gt: [{ $strLenCP: { $ifNull: ["$olympiadField", ""] } }, 0] },
                              ],
                            },
                            " — ",
                            "",
                          ],
                        },
                        { $ifNull: ["$olympiadField", ""] },
                      ],
                    },
                  },
                },
              },
              {
                case: { $gt: [{ $strLenCP: { $ifNull: ["$qudratScore", ""] } }, 0] },
                then: "$qudratScore",
              },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$nameAr", ""] } }, 0] }, then: "$nameAr" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$title", ""] } }, 0] }, then: "$title" },
            ],
            default: { $ifNull: ["$achievementType", ""] },
          },
        },
      },
    },
    {
      $addFields: {
        ...mongoAnalyticsCategoryAddFields(),
        effGender: { $cond: [{ $eq: ["$effGenderRaw", "female"] }, "female", "male"] },
        effSection: { $cond: [{ $eq: ["$effSectionRaw", "international"] }, "international", "arabic"] },
        effYear: {
          $ifNull: ["$achievementYear", { $year: { $ifNull: ["$date", "$createdAt"] } }],
        },
        levelRank: {
          $switch: {
            branches: [
              { case: { $in: ["$legacyL", ["global", "world"]] }, then: 7 },
              { case: { $eq: ["$achievementLevel", "international"] }, then: 6 },
              { case: { $eq: ["$achievementLevel", "kingdom"] }, then: 5 },
              { case: { $eq: ["$achievementLevel", "province"] }, then: 3 },
              { case: { $eq: ["$achievementLevel", "school"] }, then: 2 },
            ],
            default: 2,
          },
        },
      },
    },
    ...postStages,
  ];

  const facetBody: Record<string, mongoose.PipelineStage[]> = {
    kpi: [
      {
        $group: {
          _id: null,
          totalParticipations: { $sum: 1 },
          students: { $addToSet: "$participantId" },
          mawhibaRows: { $sum: { $cond: ["$effMawhiba", 1, 0] } },
          femaleRows: { $sum: { $cond: [{ $eq: ["$effGender", "female"] }, 1, 0] } },
          internationalRows: { $sum: { $cond: [{ $eq: ["$effSection", "international"] }, 1, 0] } },
          gold: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "gold"] }] },
                1,
                0,
              ],
            },
          },
          first: {
            $sum: {
              $cond: [{ $and: [{ $eq: ["$resultType", "rank"] }, { $eq: ["$rank", "first"] }] }, 1, 0],
            },
          },
          nom: { $sum: { $cond: [{ $eq: ["$resultType", "nomination"] }, 1, 0] } },
          maxLevelRank: { $max: "$levelRank" },
          intlAch: { $sum: { $cond: [{ $eq: ["$achievementLevel", "international"] }, 1, 0] } },
          globalAch: {
            $sum: {
              $cond: [{ $in: ["$legacyL", ["global", "world"]] }, 1, 0] },
          },
          approvedAll: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        },
      },
    ],
    genderChart: [{ $group: { _id: "$effGender", count: { $sum: 1 } } }],
    sectionChart: [{ $group: { _id: "$effSection", count: { $sum: 1 } } }],
    mawhibaChart: [
      {
        $group: {
          _id: { $cond: ["$effMawhiba", "mawhiba", "non"] },
          count: { $sum: 1 },
        },
      },
    ],
    resultDist: [
      {
        $group: {
          _id: { rt: "$resultType", mt: "$medalType", rk: "$rank" },
          count: { $sum: 1 },
        },
      },
    ],
    levelDist: [{ $group: { _id: "$achievementLevel", count: { $sum: 1 } } }],
    genderResult: [
      {
        $group: {
          _id: { g: "$effGender", rt: "$resultType", mt: "$medalType" },
          count: { $sum: 1 },
        },
      },
    ],
    activityOptions: [
      {
        $group: {
          _id: { t: "$analyticsCategory", r: "$activityRaw" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 450 },
    ],
    yearTrend: [
      {
        $group: {
          _id: "$effYear",
          totalParticipations: { $sum: 1 },
          students: { $addToSet: "$participantId" },
          gold: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "gold"] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ],
    resultBuckets: [
      {
        $group: {
          _id: null,
          gold: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "gold"] }] },
                1,
                0,
              ],
            },
          },
          silver: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "silver"] }] },
                1,
                0,
              ],
            },
          },
          bronze: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "bronze"] }] },
                1,
                0,
              ],
            },
          },
          nomination: { $sum: { $cond: [{ $eq: ["$resultType", "nomination"] }, 1, 0] } },
          rank: { $sum: { $cond: [{ $eq: ["$resultType", "rank"] }, 1, 0] } },
          participation: { $sum: { $cond: [{ $eq: ["$resultType", "participation"] }, 1, 0] } },
          otherOutcomes: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$resultType",
                    ["completion", "score", "recognition", "special_award", "other", "award"],
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ],
    activityGroups: [
      {
        $group: {
          _id: { t: "$analyticsCategory", raw: "$activityRaw" },
          participantIds: { $addToSet: "$participantId" },
          maleIds: {
            $addToSet: {
              $cond: [{ $eq: ["$effGender", "male"] }, "$participantId", "$$REMOVE"],
            },
          },
          femaleIds: {
            $addToSet: {
              $cond: [{ $eq: ["$effGender", "female"] }, "$participantId", "$$REMOVE"],
            },
          },
          arabicIds: {
            $addToSet: {
              $cond: [{ $eq: ["$effSection", "arabic"] }, "$participantId", "$$REMOVE"],
            },
          },
          internationalIds: {
            $addToSet: {
              $cond: [{ $eq: ["$effSection", "international"] }, "$participantId", "$$REMOVE"],
            },
          },
          mawhibaIds: {
            $addToSet: {
              $cond: ["$effMawhiba", "$participantId", "$$REMOVE"],
            },
          },
          nonMawhibaIds: {
            $addToSet: {
              $cond: [{ $eq: ["$effMawhiba", false] }, "$participantId", "$$REMOVE"],
            },
          },
          approvedAchievements: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          totalParticipations: { $sum: 1 },
          maxLevelRank: { $max: "$levelRank" },
          levelsSeen: { $addToSet: "$achievementLevel" },
          resultCombos: { $push: { rt: "$resultType", mt: "$medalType", rk: "$rank" } },
          achievementClassification: { $first: { $ifNull: ["$achievementClassification", ""] } },
          goldMedalCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "gold"] }] },
                1,
                0,
              ],
            },
          },
          silverMedalCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "silver"] }] },
                1,
                0,
              ],
            },
          },
          bronzeMedalCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "bronze"] }] },
                1,
                0,
              ],
            },
          },
          rankCount: { $sum: { $cond: [{ $eq: ["$resultType", "rank"] }, 1, 0] } },
          nominationRowCount: { $sum: { $cond: [{ $eq: ["$resultType", "nomination"] }, 1, 0] } },
          participationOnlyCount: { $sum: { $cond: [{ $eq: ["$resultType", "participation"] }, 1, 0] } },
        },
      },
      { $sort: { totalParticipations: -1 } },
    ],
  };

  const [facetResult] = await Achievement.aggregate(
    [...shapedPipeline, { $facet: facetBody }] as mongoose.PipelineStage[]
  ).allowDiskUse(true);

  const kpiRow = facetResult?.kpi?.[0] as
    | {
        totalParticipations?: number;
        students?: unknown[];
        mawhibaRows?: number;
        femaleRows?: number;
        internationalRows?: number;
        gold?: number;
        first?: number;
        nom?: number;
        maxLevelRank?: number;
        intlAch?: number;
        globalAch?: number;
        approvedAll?: number;
      }
    | undefined;

  const totalParticipations = Number(kpiRow?.totalParticipations || 0);
  const distinctStudents = Array.isArray(kpiRow?.students) ? kpiRow!.students!.length : 0;
  const mawhibaRows = Number(kpiRow?.mawhibaRows || 0);
  const femaleRows = Number(kpiRow?.femaleRows || 0);
  const internationalRows = Number(kpiRow?.internationalRows || 0);
  const goldMedalCount = Number(kpiRow?.gold || 0);
  const firstPlaceCount = Number(kpiRow?.first || 0);
  const nominationCount = Number(kpiRow?.nom || 0);
  const maxLevelRank = Number(kpiRow?.maxLevelRank || 2);
  const intlAch = Number(kpiRow?.intlAch || 0);
  const globalAch = Number(kpiRow?.globalAch || 0);
  const approvedAll = Number(kpiRow?.approvedAll || 0);

  const activityGroups = (facetResult?.activityGroups || []) as Array<{
    _id: { t: string; raw: string };
    participantIds: unknown[];
    maleIds: unknown[];
    femaleIds: unknown[];
    arabicIds: unknown[];
    internationalIds: unknown[];
    mawhibaIds: unknown[];
    nonMawhibaIds: unknown[];
    approvedAchievements: number;
    totalParticipations: number;
    maxLevelRank: number;
    levelsSeen: string[];
    resultCombos: Array<{ rt?: string; mt?: string; rk?: string }>;
    achievementClassification?: string;
    goldMedalCount?: number;
    silverMedalCount?: number;
    bronzeMedalCount?: number;
    rankCount?: number;
    nominationRowCount?: number;
    participationOnlyCount?: number;
  }>;

  const tableTotal = activityGroups.length;
  const skip = (page - 1) * pageSize;
  const pageSlice = activityGroups.slice(skip, skip + pageSize);

  const mapTypeUi = (typeKey: string): { ar: string; en: string } => ({
    ar: getDbAchievementTypeLabel(typeKey, "ar"),
    en: getDbAchievementTypeLabel(typeKey, "en"),
  });

  const table: ParticipationActivityRow[] = pageSlice.map((g) => {
    const typeKey = String(g._id?.t || "");
    const raw = String(g._id?.raw ?? "");
    const activityLabelAr = resolveAchievementActivityName(typeKey, raw, "ar");
    const activityLabelEn = resolveAchievementActivityName(typeKey, raw, "en");
    const typeLbl = mapTypeUi(typeKey);
    const classKey = String(g.achievementClassification || "").trim();
    const maxRank = Number(g.maxLevelRank || 2);
    const levelKey = levelKeyFromMaxRank(maxRank);
    const levelLabelAr = getAchievementLevelLabel(levelKey, "ar");
    const levelLabelEn = getAchievementLevelLabel(levelKey, "en");

    const domAr = dominantResultFromCombos(g.resultCombos || [], "ar");
    const domEn = dominantResultFromCombos(g.resultCombos || [], "en");

    const distinctP = Array.isArray(g.participantIds) ? g.participantIds.length : 0;
    const approved = Number(g.approvedAchievements || 0);
    const totalRows = Number(g.totalParticipations || 0);
    const excellenceRatePct =
      totalRows > 0 ? Math.round((approved / totalRows) * 1000) / 10 : 0;

    return {
      activityKey: `${typeKey}\u001f${raw}`,
      activityLabelAr,
      activityLabelEn,
      typeKey,
      typeLabelAr: typeLbl.ar,
      typeLabelEn: typeLbl.en,
      classificationKey: classKey,
      classificationLabelAr: formatAchievementClassificationLabel(classKey || undefined, "ar"),
      classificationLabelEn: formatAchievementClassificationLabel(classKey || undefined, "en"),
      levelKey,
      levelLabelAr,
      levelLabelEn,
      participationResultKey: domAr.key,
      participationResultAr: domAr.label,
      participationResultEn: domEn.label,
      totalParticipations: totalRows,
      distinctParticipants: distinctP,
      maleParticipants: Array.isArray(g.maleIds) ? g.maleIds.length : 0,
      femaleParticipants: Array.isArray(g.femaleIds) ? g.femaleIds.length : 0,
      arabicParticipants: Array.isArray(g.arabicIds) ? g.arabicIds.length : 0,
      internationalParticipants: Array.isArray(g.internationalIds) ? g.internationalIds.length : 0,
      mawhibaParticipants: Array.isArray(g.mawhibaIds) ? g.mawhibaIds.length : 0,
      nonMawhibaParticipants: Array.isArray(g.nonMawhibaIds) ? g.nonMawhibaIds.length : 0,
      goldMedalCount: Number(g.goldMedalCount || 0),
      silverMedalCount: Number(g.silverMedalCount || 0),
      bronzeMedalCount: Number(g.bronzeMedalCount || 0),
      rankCount: Number(g.rankCount || 0),
      nominationCount: Number(g.nominationRowCount || 0),
      participationOnlyCount: Number(g.participationOnlyCount || 0),
      approvedAchievements: approved,
      excellenceRatePct,
    };
  });

  const genderChart = (facetResult?.genderChart || []).map(
    (r: { _id: string; count: number }) => ({
      key: r._id,
      labelAr: r._id === "female" ? "بنات" : "بنين",
      labelEn: r._id === "female" ? "Female" : "Male",
      count: r.count,
    })
  );

  const sectionChart = (facetResult?.sectionChart || []).map(
    (r: { _id: string; count: number }) => ({
      key: r._id,
      labelAr: r._id === "international" ? "دولي" : "عربي",
      labelEn: r._id === "international" ? "International" : "Arabic",
      count: r.count,
    })
  );

  const mawhibaSplit = (facetResult?.mawhibaChart || []).map(
    (r: { _id: string; count: number }) => ({
      key: r._id,
      labelAr: r._id === "mawhiba" ? "موهبة" : "غير موهبة",
      labelEn: r._id === "mawhiba" ? "Mawhiba" : "Non-Mawhiba",
      count: r.count,
    })
  );

  const resultDist = (facetResult?.resultDist || []).map((r: { _id: { rt?: string; mt?: string; rk?: string }; count: number }) => {
    const outcome = resolveAchievementOutcome({
      resultType: String(r._id?.rt || ""),
      medalType: String(r._id?.mt || ""),
      rank: String(r._id?.rk || ""),
    });
    const labelAr = outcome.displayAr;
    const labelEn = outcome.displayEn;
    return { labelAr, labelEn, count: r.count };
  });

  const levelDist = (facetResult?.levelDist || []).map((r: { _id: string; count: number }) => ({
    labelAr: getAchievementLevelLabel(r._id, "ar"),
    labelEn: getAchievementLevelLabel(r._id, "en"),
    count: r.count,
  }));

  const genderResultRaw = facetResult?.genderResult || [];
  const genderMap = new Map<string, { gold: number; silver: number; bronze: number; ranks: number }>();
  for (const r of genderResultRaw as Array<{ _id: { g: string; rt: string; mt?: string }; count: number }>) {
    const g = r._id?.g || "male";
    const hit = genderMap.get(g) || { gold: 0, silver: 0, bronze: 0, ranks: 0 };
    if (r._id?.rt === "medal") {
      if (r._id?.mt === "gold") hit.gold += r.count;
      else if (r._id?.mt === "silver") hit.silver += r.count;
      else if (r._id?.mt === "bronze") hit.bronze += r.count;
    } else if (r._id?.rt === "rank") hit.ranks += r.count;
    genderMap.set(g, hit);
  }
  const genderResultStack = ["male", "female"].map((genderKey) => {
    const h = genderMap.get(genderKey) || { gold: 0, silver: 0, bronze: 0, ranks: 0 };
    return {
      gender: genderKey,
      labelAr: genderKey === "female" ? "بنات" : "بنين",
      labelEn: genderKey === "female" ? "Female" : "Male",
      ...h,
    };
  });

  const topPrograms = activityGroups.slice(0, 10).map((g) => {
    const typeKey = String(g._id?.t || "");
    const raw = String(g._id?.raw ?? "");
    return {
      labelAr: resolveAchievementActivityName(typeKey, raw, "ar"),
      labelEn: resolveAchievementActivityName(typeKey, raw, "en"),
      studentCount: Array.isArray(g.participantIds) ? g.participantIds.length : 0,
      rows: g.totalParticipations,
    };
  });

  const activityHorizontal = topPrograms.map((x) => ({
    labelAr: x.labelAr,
    labelEn: x.labelEn,
    studentCount: x.studentCount,
  }));

  const top = activityGroups[0];
  let topProgramLabelAr = "—";
  let topProgramLabelEn = "—";
  if (top) {
    topProgramLabelAr = resolveAchievementActivityName(String(top._id?.t || ""), String(top._id?.raw ?? ""), "ar");
    topProgramLabelEn = resolveAchievementActivityName(String(top._id?.t || ""), String(top._id?.raw ?? ""), "en");
  }

  let topSectionLabelAr = "—";
  let topSectionLabelEn = "—";
  const secMax = [...sectionChart].sort((a, b) => b.count - a.count)[0];
  if (secMax) {
    topSectionLabelAr = secMax.labelAr;
    topSectionLabelEn = secMax.labelEn;
  }

  const highestLevelKey = levelKeyFromMaxRank(maxLevelRank);

  const optRaw = (facetResult?.activityOptions || []) as Array<{ _id: { t: string; r: string }; count: number }>;
  const activityOptions = optRaw.map((row) => {
    const typeKey = String(row._id?.t || "");
    const rawKey = String(row._id?.r ?? "");
    return {
      typeKey,
      rawKey,
      count: Number(row.count || 0),
      labelAr: resolveAchievementActivityName(typeKey, rawKey, "ar"),
      labelEn: resolveAchievementActivityName(typeKey, rawKey, "en"),
    };
  });

  const focusedActivity = null;

  const rb = facetResult?.resultBuckets?.[0] as
    | {
        gold?: number;
        silver?: number;
        bronze?: number;
        nomination?: number;
        rank?: number;
        participation?: number;
        otherOutcomes?: number;
      }
    | undefined;
  const resultOutcomeCompare = [
    {
      key: "gold",
      labelAr: "ذهبية",
      labelEn: "Gold",
      count: Number(rb?.gold || 0),
      color: "#CA8A04",
    },
    {
      key: "silver",
      labelAr: "فضية",
      labelEn: "Silver",
      count: Number(rb?.silver || 0),
      color: "#94A3B8",
    },
    {
      key: "bronze",
      labelAr: "برونزية",
      labelEn: "Bronze",
      count: Number(rb?.bronze || 0),
      color: "#B45309",
    },
    {
      key: "nomination",
      labelAr: "ترشيح",
      labelEn: "Nomination",
      count: Number(rb?.nomination || 0),
      color: "#7C3AED",
    },
    {
      key: "rank",
      labelAr: "مراكز",
      labelEn: "Ranks",
      count: Number(rb?.rank || 0),
      color: "#0D9488",
    },
    {
      key: "participation",
      labelAr: "مشاركة",
      labelEn: "Participation",
      count: Number(rb?.participation || 0),
      color: "#2563EB",
    },
    {
      key: "other",
      labelAr: "نتائج أخرى",
      labelEn: "Other outcomes",
      count: Number(rb?.otherOutcomes || 0),
      color: "#64748B",
    },
  ];

  const yTrendRaw = (facetResult?.yearTrend || []) as Array<{
    _id: number | null;
    students?: unknown[];
    totalParticipations?: number;
    gold?: number;
  }>;
  const yearTrend = yTrendRaw
    .filter((y) => typeof y._id === "number" && Number(y._id) >= 1990)
    .map((y) => ({
      year: Number(y._id),
      totalRows: Number(y.totalParticipations || 0),
      distinctStudents: Array.isArray(y.students) ? y.students.length : 0,
      goldMedals: Number(y.gold || 0),
    }));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    filters,
    kpis: {
      totalParticipations,
      distinctStudents,
      mawhibaParticipationPct:
        totalParticipations > 0 ? Math.round((mawhibaRows / totalParticipations) * 1000) / 10 : 0,
      femalePct: totalParticipations > 0 ? Math.round((femaleRows / totalParticipations) * 1000) / 10 : 0,
      internationalSectionPct:
        totalParticipations > 0 ? Math.round((internationalRows / totalParticipations) * 1000) / 10 : 0,
      activeProgramsCount: tableTotal,
      topProgramLabelAr,
      topProgramLabelEn,
      topSectionLabelAr,
      topSectionLabelEn,
      goldMedalCount,
      firstPlaceCount,
      nominationCount,
      highestLevelLabelAr: getAchievementLevelLabel(highestLevelKey, "ar"),
      highestLevelLabelEn: getAchievementLevelLabel(highestLevelKey, "en"),
      internationalAchievementPct:
        totalParticipations > 0 ? Math.round((intlAch / totalParticipations) * 1000) / 10 : 0,
      globalAchievementPct:
        totalParticipations > 0 ? Math.round((globalAch / totalParticipations) * 1000) / 10 : 0,
    },
    charts: {
      genderParticipation: genderChart,
      sectionParticipation: sectionChart,
      mawhibaSplit,
      resultDistribution: resultDist,
      levelDistribution: levelDist,
      genderResultStack,
      topPrograms,
      activityHorizontal,
      resultOutcomeCompare,
      yearTrend,
    },
    activityOptions,
    focusedActivity,
    table,
    tableTotal,
    page,
    pageSize,
  };
};

export const parseParticipationFiltersFromSearchParams = (
  sp: URLSearchParams
): ParticipationAnalyticsFilters => {
  const focusT = String(sp.get("focusType") || "").trim();
  return {
    academicYear: String(sp.get("academicYear") || "").trim() || undefined,
    achievementYear: sp.get("achievementYear")
      ? parseInt(String(sp.get("achievementYear")), 10)
      : undefined,
    gender: String(sp.get("gender") || "all").trim(),
    genders: deserializeMultiFilterWithLegacy(sp.get("genders"), sp.get("gender")),
    mawhiba: String(sp.get("mawhiba") || "all").trim(),
    mawhibaValues: deserializeMultiFilterWithLegacy(sp.get("mawhibaValues"), sp.get("mawhiba")),
    stage: String(sp.get("stage") || "all").trim(),
    stages: deserializeMultiFilterWithLegacy(sp.get("stages"), sp.get("stage")),
    grade: String(sp.get("grade") || "all").trim(),
    grades: deserializeMultiFilterWithLegacy(sp.get("grades"), sp.get("grade")),
    section: String(sp.get("section") || "all").trim(),
    categories: parseReportCsvParam(sp.get("category")),
    achievementName: String(sp.get("achievementName") || "").trim() || undefined,
    achievementNames: deserializeMultiFilterWithLegacy(
      sp.get("achievementNames"),
      sp.get("achievementName")
    ),
    activityYears: normalizeNumericMultiFilter(
      deserializeMultiFilter(sp.get("activityYears")),
      sp.get("filterActivityYear")
    ),
    filterActivityYear: String(sp.get("filterActivityYear") || "").trim() || undefined,
    standardizedTestTypes: deserializeMultiFilter(sp.get("standardizedTestTypes")),
    levels: parseReportCsvParam(sp.get("level")),
    resultTokens: parseReportCsvParam(sp.get("result")),
    status: String(sp.get("status") || "all").trim(),
    statuses: deserializeMultiFilterWithLegacy(sp.get("statuses"), sp.get("status")),
    certificateStatus: String(sp.get("certificateStatus") || "all").trim(),
    certificateStatuses: deserializeMultiFilterWithLegacy(
      sp.get("certificateStatuses"),
      sp.get("certificateStatus")
    ),
    fromDate: String(sp.get("fromDate") || "").trim() || undefined,
    toDate: String(sp.get("toDate") || "").trim() || undefined,
    domain: String(sp.get("domain") || "").trim() || undefined,
    classification: String(sp.get("classification") || "").trim() || undefined,
    organization: String(sp.get("organization") || "").trim() || undefined,
    primaryAchievementType: String(sp.get("primaryType") || "all").trim(),
    activityFocusType: focusT || undefined,
    activityFocusRaw: focusT ? String(sp.get("focusRaw") ?? "") : undefined,
  };
};

export { buildParticipationMongoMatch };
