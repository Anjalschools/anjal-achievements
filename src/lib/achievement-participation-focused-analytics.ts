import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import {
  buildParticipationMongoMatch,
  parseParticipationFiltersFromSearchParams,
  type ParticipationAnalyticsFilters,
} from "@/lib/achievement-participation-analytics";
import { resolveAchievementActivityName } from "@/lib/resolve-achievement-activity-name";
import { formatLocalizedResultLine, getAchievementLevelLabel } from "@/lib/achievementDisplay";
import { resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import { getGradeLabel } from "@/constants/grades";
import {
  FOCUSED_ACHIEVEMENT_OUTCOMES,
  type FocusedAchievementOutcome,
  type FocusedActivityOptionRow,
  type FocusedActivityParticipantRow,
  type FocusedActivityReportPayload,
} from "@/types/focused-activity-report";
import {
  buildCompetitionDecisionPlatform,
  type PeerActivityMetricRow,
} from "@/lib/competition-decision-intelligence";
import { mongoAnalyticsCategoryAddFields } from "@/lib/analytics/mongo-analytics-category";
import {
  buildTopPerformersFromRankingPool,
  type RankingPoolRow,
} from "@/lib/analytics/build-top-performers-weighted";
import {
  trimFocusedPayloadForTransport,
  validateFocusedPayloadSize,
} from "@/lib/analytics/focused-payload-governor";
import {
  logFocusedAggregationStart,
  readFocusedRuntimeSnapshot,
  recordFocusedAggregationTiming,
} from "@/lib/analytics/focused-runtime-guard";
import { maybeExplainFocusedPipeline } from "@/lib/analytics/focused-agg-explain";
import { sanitizeFocusedChartsPayload } from "@/lib/analytics/focused-chart-validation";
import {
  buildParticipantRows,
  resolveParticipantActivityLabel,
} from "@/lib/analytics/export/participant-activity-name";

export { buildParticipantRows, resolveParticipantActivityLabel };

export {
  FOCUSED_ACHIEVEMENT_OUTCOMES,
  type FocusedAchievementOutcome,
  type FocusedActivityParticipantRow,
  type FocusedActivityReportPayload,
};

export const focusedOutcomeToMongo = (o: string): Record<string, unknown> | null => {
  const x = String(o || "").trim();
  if (!x || x === "all") return null;
  switch (x) {
    case "medal_gold":
      return { resultType: "medal", medalType: "gold" };
    case "medal_silver":
      return { resultType: "medal", medalType: "silver" };
    case "medal_bronze":
      return { resultType: "medal", medalType: "bronze" };
    case "rank_first":
      return { resultType: "rank", rank: "first" };
    case "rank_second":
      return { resultType: "rank", rank: "second" };
    case "rank_third":
      return { resultType: "rank", rank: "third" };
    case "nomination":
      return { resultType: "nomination" };
    case "participation":
      return { resultType: "participation" };
    case "completion":
      return { resultType: "completion" };
    case "score":
      return { resultType: "score" };
    case "recognition":
      return { resultType: "recognition" };
    case "special_award":
      return { resultType: "special_award" };
    default:
      return null;
  }
};

const GRADES_BY_STAGE: Record<string, string[]> = {
  primary: ["g1", "g2", "g3", "g4", "g5", "g6"],
  middle: ["g7", "g8", "g9"],
  secondary: ["g10", "g11", "g12"],
};

const postDemographicStages = (filters: ParticipationAnalyticsFilters): mongoose.PipelineStage[] => {
  const postStages: mongoose.PipelineStage[] = [];
  const stage = String(filters.stage || "").trim();
  if (stage !== "all" && stage && GRADES_BY_STAGE[stage]) {
    postStages.push({ $match: { effGrade: { $in: GRADES_BY_STAGE[stage] } } });
  }
  const grade = String(filters.grade || "").trim();
  if (grade && grade !== "all") {
    postStages.push({ $match: { effGrade: grade.toLowerCase() } });
  }
  const gender = String(filters.gender || "").trim();
  if (gender && gender !== "all") {
    postStages.push({ $match: { effGender: gender } });
  }
  const section = String(filters.section || "").trim();
  if (section && section !== "all") {
    postStages.push({ $match: { effSection: section } });
  }
  const mh = String(filters.mawhiba || "").trim();
  if (mh === "yes") postStages.push({ $match: { effMawhiba: true } });
  if (mh === "no") postStages.push({ $match: { effMawhiba: { $ne: true } } });
  return postStages;
};

export const buildShapedStages = (filters: ParticipationAnalyticsFilters): mongoose.PipelineStage[] => {
  const baseMatch = buildParticipationMongoMatch(filters);
  return [
    { $match: baseMatch },
    {
      $lookup: {
        from: "users",
        let: { uid: "$userId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
          {
            $project: {
              gender: 1,
              section: 1,
              isMawhibaStudent: 1,
              grade: 1,
              fullName: 1,
              fullNameAr: 1,
              fullNameEn: 1,
              profilePhoto: 1,
            },
          },
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
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$customAchievementName", ""] } }, 0] }, then: "$customAchievementName" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$achievementName", ""] } }, 0] }, then: "$achievementName" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$inferredField", ""] } }, 0] }, then: "$inferredField" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$customProgramName", ""] } }, 0] }, then: "$customProgramName" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$programName", ""] } }, 0] }, then: "$programName" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$customCompetitionName", ""] } }, 0] }, then: "$customCompetitionName" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$competitionName", ""] } }, 0] }, then: "$competitionName" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$exhibitionName", ""] } }, 0] }, then: "$exhibitionName" },
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$customExhibitionName", ""] } }, 0] }, then: "$customExhibitionName" },
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
              { case: { $gt: [{ $strLenCP: { $ifNull: ["$qudratScore", ""] } }, 0] }, then: "$qudratScore" },
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
        effStage: {
          $switch: {
            branches: [
              { case: { $in: ["$effGrade", ["g1", "g2", "g3", "g4", "g5", "g6"]] }, then: "primary" },
              { case: { $in: ["$effGrade", ["g7", "g8", "g9"]] }, then: "middle" },
              { case: { $in: ["$effGrade", ["g10", "g11", "g12"]] }, then: "secondary" },
            ],
            default: "unknown",
          },
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
    ...postDemographicStages(filters),
  ];
};

export const loadPeerActivityMetrics = async (
  filters: ParticipationAnalyticsFilters
): Promise<PeerActivityMetricRow[]> => {
  const shaped = buildShapedStages(filters);
  const raw = (await Achievement.aggregate([
    ...shaped,
    {
      $group: {
        _id: { t: "$analyticsCategory", r: "$activityRaw" },
        records: { $sum: 1 },
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
        participation: { $sum: { $cond: [{ $eq: ["$resultType", "participation"] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        intl: { $sum: { $cond: [{ $eq: ["$effSection", "international"] }, 1, 0] } },
      },
    },
    { $match: { records: { $gte: 3 } } },
    {
      $project: {
        _id: 0,
        typeKey: "$_id.t",
        rawKey: "$_id.r",
        records: 1,
        distinctStudents: { $size: "$students" },
        gold: 1,
        silver: 1,
        bronze: 1,
        nomination: 1,
        participation: 1,
        approved: 1,
        intl: 1,
      },
    },
    { $sort: { records: -1 } },
    { $limit: 56 },
  ] as mongoose.PipelineStage[]).allowDiskUse(true)) as Array<{
    typeKey: string;
    rawKey: string;
    records: number;
    distinctStudents: number;
    gold: number;
    silver: number;
    bronze: number;
    nomination: number;
    participation: number;
    approved: number;
    intl: number;
  }>;

  return raw.map((r) => {
    const rec = Math.max(0, Number(r.records || 0));
    const g = Number(r.gold || 0);
    const s = Number(r.silver || 0);
    const b = Number(r.bronze || 0);
    const nom = Number(r.nomination || 0);
    const part = Number(r.participation || 0);
    const appr = Number(r.approved || 0);
    const intl = Number(r.intl || 0);
    const tk = String(r.typeKey || "");
    const rk = String(r.rawKey ?? "");
    return {
      typeKey: tk,
      rawKey: rk,
      labelAr: resolveAchievementActivityName(tk, rk, "ar"),
      labelEn: resolveAchievementActivityName(tk, rk, "en"),
      records: rec,
      distinctStudents: Number(r.distinctStudents || 0),
      gold: g,
      silver: s,
      bronze: b,
      totalMedals: g + s + b,
      nomination: nom,
      participation: part,
      approved: appr,
      excellenceRatePct: rec > 0 ? Math.round((appr / rec) * 1000) / 10 : 0,
      intlSharePct: rec > 0 ? Math.round((intl / rec) * 1000) / 10 : 0,
      participationOnlyRatio: rec > 0 ? Math.round((part / rec) * 1000) / 10 : 0,
    };
  });
};

export const buildFocusedActivityOptionsList = async (
  filters: ParticipationAnalyticsFilters
): Promise<FocusedActivityOptionRow[]> => {
  await connectDB();
  const shaped = buildShapedStages(filters);

  const [facet] = await Achievement.aggregate([
    ...shaped,
    {
      $facet: {
        opts: [
          { $group: { _id: { t: "$achievementType", r: "$activityRaw" }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 450 },
        ],
      },
    },
  ] as mongoose.PipelineStage[]).allowDiskUse(true);

  const raw = (facet?.opts || []) as Array<{ _id: { t: string; r: string }; count: number }>;
  return raw.map((row) => {
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
};

const stageLabel = (key: string, loc: "ar" | "en"): string => {
  if (key === "primary") return loc === "ar" ? "ابتدائي" : "Primary";
  if (key === "middle") return loc === "ar" ? "متوسط" : "Middle";
  if (key === "secondary") return loc === "ar" ? "ثانوي" : "Secondary";
  return loc === "ar" ? "غير محدد" : "N/A";
};

const levelKeyFromMaxRank = (maxRank: number): string => {
  if (maxRank >= 7) return "global";
  if (maxRank === 6) return "international";
  if (maxRank === 5) return "kingdom";
  if (maxRank === 3) return "province";
  return "school";
};

const trendDir = (pct: number | null): "up" | "down" | "flat" => {
  if (pct == null || Number.isNaN(pct)) return "flat";
  if (pct > 0.5) return "up";
  if (pct < -0.5) return "down";
  return "flat";
};

const pctChange = (curr: number, prev: number | null | undefined): number | null => {
  if (prev == null || prev === undefined || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};

export type FocusPipeline = mongoose.PipelineStage[];

export const buildFocusPipeline = (input: {
  filters: ParticipationAnalyticsFilters;
  focusType: string;
  focusRaw: string;
  focusedOutcome: string;
}): { pipeline: FocusPipeline; focusType: string; focusRaw: string; outcome: string } => {
  const focusType = String(input.focusType || "").trim();
  const focusRaw = String(input.focusRaw ?? "");
  const outcome = String(input.focusedOutcome || "all").trim();
  const outcomeMatch = focusedOutcomeToMongo(
    FOCUSED_ACHIEVEMENT_OUTCOMES.includes(outcome as FocusedAchievementOutcome) ? outcome : "all"
  );
  const shaped = buildShapedStages(input.filters);
  const focusStages: mongoose.PipelineStage[] = [
    {
      $match: {
        activityRaw: focusRaw,
        $or: [{ analyticsCategory: focusType }, { achievementType: focusType }],
      },
    },
  ];
  if (outcomeMatch) focusStages.push({ $match: outcomeMatch });
  return { pipeline: [...shaped, ...focusStages], focusType, focusRaw, outcome };
};

export const PARTICIPANTS_LIGHT_MODE_THRESHOLD = 1000;

const ACTIVITY_RAW_SWITCH = {
  $switch: {
    branches: [
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$customAchievementName", ""] } }, 0] }, then: "$customAchievementName" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$achievementName", ""] } }, 0] }, then: "$achievementName" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$inferredField", ""] } }, 0] }, then: "$inferredField" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$customProgramName", ""] } }, 0] }, then: "$customProgramName" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$programName", ""] } }, 0] }, then: "$programName" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$customCompetitionName", ""] } }, 0] }, then: "$customCompetitionName" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$competitionName", ""] } }, 0] }, then: "$competitionName" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$exhibitionName", ""] } }, 0] }, then: "$exhibitionName" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$customExhibitionName", ""] } }, 0] }, then: "$customExhibitionName" },
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
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$qudratScore", ""] } }, 0] }, then: "$qudratScore" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$nameAr", ""] } }, 0] }, then: "$nameAr" },
      { case: { $gt: [{ $strLenCP: { $ifNull: ["$title", ""] } }, 0] }, then: "$title" },
    ],
    default: { $ifNull: ["$achievementType", ""] },
  },
} as const;

/** Snapshot-first shaping — no user $lookup (paginate before lookup). */
const buildParticipantsMiniShapedStages = (
  filters: ParticipationAnalyticsFilters
): mongoose.PipelineStage[] => {
  const baseMatch = buildParticipationMongoMatch(filters);
  return [
    { $match: baseMatch },
    {
      $addFields: {
        participantId: {
          $ifNull: ["$userId", { $ifNull: ["$studentProfileKey", "$_id"] }],
        },
        activityRaw: ACTIVITY_RAW_SWITCH,
      },
    },
    {
      $addFields: {
        ...mongoAnalyticsCategoryAddFields(),
        effGrade: {
          $toLower: {
            $trim: { input: { $ifNull: ["$studentSnapshot.grade", ""] } },
          },
        },
        effGenderRaw: {
          $toLower: {
            $trim: { input: { $ifNull: ["$studentSnapshot.gender", "male"] } },
          },
        },
        effSectionRaw: {
          $toLower: {
            $trim: { input: { $ifNull: ["$studentSnapshot.section", "arabic"] } },
          },
        },
        effMawhiba: {
          $eq: [{ $ifNull: ["$studentSnapshot.isMawhibaStudent", false] }, true],
        },
      },
    },
    {
      $addFields: {
        effGender: { $cond: [{ $eq: ["$effGenderRaw", "female"] }, "female", "male"] },
        effSection: {
          $cond: [{ $eq: ["$effSectionRaw", "international"] }, "international", "arabic"],
        },
        effYear: {
          $ifNull: ["$achievementYear", { $year: { $ifNull: ["$date", "$createdAt"] } }],
        },
        effStage: {
          $switch: {
            branches: [
              { case: { $in: ["$effGrade", ["g1", "g2", "g3", "g4", "g5", "g6"]] }, then: "primary" },
              { case: { $in: ["$effGrade", ["g7", "g8", "g9"]] }, then: "middle" },
              { case: { $in: ["$effGrade", ["g10", "g11", "g12"]] }, then: "secondary" },
            ],
            default: "unknown",
          },
        },
      },
    },
    ...postDemographicStages(filters),
  ];
};

const buildParticipantsFocusStages = (
  focusType: string,
  focusRaw: string,
  focusedOutcome: string
): mongoose.PipelineStage[] => {
  const outcome = String(focusedOutcome || "all").trim();
  const outcomeMatch = focusedOutcomeToMongo(
    FOCUSED_ACHIEVEMENT_OUTCOMES.includes(outcome as FocusedAchievementOutcome) ? outcome : "all"
  );
  const stages: mongoose.PipelineStage[] = [
    {
      $match: {
        activityRaw: focusRaw,
        $or: [{ analyticsCategory: focusType }, { achievementType: focusType }],
      },
    },
  ];
  if (outcomeMatch) stages.push({ $match: outcomeMatch });
  return stages;
};

const PARTICIPANTS_PAGE_LOOKUP: mongoose.PipelineStage[] = [
  {
    $lookup: {
      from: "users",
      let: { uid: "$userId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
        {
          $project: {
            fullName: 1,
            fullNameAr: 1,
            fullNameEn: 1,
            profilePhoto: 1,
            gender: 1,
            section: 1,
            grade: 1,
            isMawhibaStudent: 1,
          },
        },
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
            input: {
              $ifNull: ["$u.grade", { $ifNull: ["$studentSnapshot.grade", "$effGrade"] }],
            },
          },
        },
      },
      effGenderRaw: {
        $toLower: {
          $trim: {
            input: {
              $ifNull: ["$u.gender", { $ifNull: ["$studentSnapshot.gender", "$effGenderRaw"] }],
            },
          },
        },
      },
      effSectionRaw: {
        $toLower: {
          $trim: {
            input: {
              $ifNull: ["$u.section", { $ifNull: ["$studentSnapshot.section", "$effSectionRaw"] }],
            },
          },
        },
      },
      effMawhiba: {
        $cond: {
          if: { $eq: [{ $type: "$u.isMawhibaStudent" }, "bool"] },
          then: "$u.isMawhibaStudent",
          else: "$effMawhiba",
        },
      },
    },
  },
  {
    $addFields: {
      effGender: { $cond: [{ $eq: ["$effGenderRaw", "female"] }, "female", "male"] },
      effSection: {
        $cond: [{ $eq: ["$effSectionRaw", "international"] }, "international", "arabic"],
      },
      effStage: {
        $switch: {
          branches: [
            { case: { $in: ["$effGrade", ["g1", "g2", "g3", "g4", "g5", "g6"]] }, then: "primary" },
            { case: { $in: ["$effGrade", ["g7", "g8", "g9"]] }, then: "middle" },
            { case: { $in: ["$effGrade", ["g10", "g11", "g12"]] }, then: "secondary" },
          ],
          default: "$effStage",
        },
      },
    },
  },
  {
    $project: {
      _id: 1,
      resultType: 1,
      medalType: 1,
      rank: 1,
      resultValue: 1,
      achievementLevel: 1,
      achievementYear: 1,
      organization: 1,
      status: 1,
      approved: 1,
      isFeatured: 1,
      featured: 1,
      pendingReReview: 1,
      verificationStatus: 1,
      achievementType: 1,
      giftedDiscoveryScore: 1,
      effGender: 1,
      effSection: 1,
      effMawhiba: 1,
      effGrade: 1,
      effStage: 1,
      effYear: 1,
      u: 1,
      studentSnapshot: { fullNameAr: 1, fullNameEn: 1 },
    },
  },
];

const LEAN_ROW_PROJECT: Record<string, 1> = {
  _id: 1,
  createdAt: 1,
  resultType: 1,
  medalType: 1,
  rank: 1,
  resultValue: 1,
  achievementLevel: 1,
  achievementYear: 1,
  organization: 1,
  status: 1,
  approved: 1,
  isFeatured: 1,
  featured: 1,
  pendingReReview: 1,
  verificationStatus: 1,
  activityRaw: 1,
  achievementType: 1,
  achievementName: 1,
  competitionName: 1,
  customCompetitionName: 1,
  programName: 1,
  customAchievementName: 1,
  giftedDiscoveryScore: 1,
  effGender: 1,
  effSection: 1,
  effMawhiba: 1,
  effGrade: 1,
  effStage: 1,
  effYear: 1,
  u: 1,
  studentSnapshot: 1,
};

/** KPI without $addToSet student arrays (prevents BSON overflow in $facet). */
export const aggregateFocusedKpiMetrics = async (
  pipeline: FocusPipeline
): Promise<{
  totalRecords: number;
  distinctStudents: number;
  approvedRecords: number;
  excellenceRatePct: number;
}> => {
  const [[kpiRow], distinctRows] = await Promise.all([
    Achievement.aggregate([
      ...pipeline,
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          approvedRecords: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        },
      },
    ] as mongoose.PipelineStage[]).allowDiskUse(true),
    Achievement.aggregate([
      ...pipeline,
      { $group: { _id: "$participantId" } },
      { $count: "distinctStudents" },
    ] as mongoose.PipelineStage[]).allowDiskUse(true),
  ]);
  const totalRecords = Number((kpiRow as { totalRecords?: number })?.totalRecords || 0);
  const approvedRecords = Number((kpiRow as { approvedRecords?: number })?.approvedRecords || 0);
  const distinctStudents = Number(
    (distinctRows[0] as { distinctStudents?: number } | undefined)?.distinctStudents || 0
  );
  const excellenceRatePct =
    totalRecords > 0 ? Math.round((approvedRecords / totalRecords) * 1000) / 10 : 0;
  return { totalRecords, distinctStudents, approvedRecords, excellenceRatePct };
};

const mapParticipantRowsFromDocs = (
  rowDocs: Array<Record<string, unknown>>,
  focusType: string,
  focusRaw: string,
  opts?: {
    light?: boolean;
    activityLabelAr?: string;
    activityLabelEn?: string;
  }
): FocusedActivityParticipantRow[] =>
  rowDocs.map((doc) => {
    const u = doc.u as {
      fullName?: string;
      fullNameAr?: string;
      fullNameEn?: string;
      profilePhoto?: string;
    } | null;
    const snap = doc.studentSnapshot as { fullNameAr?: string; fullNameEn?: string } | undefined;
    const studentNameAr =
      (u?.fullNameAr && String(u.fullNameAr).trim()) ||
      (snap?.fullNameAr && String(snap.fullNameAr).trim()) ||
      (u?.fullName && String(u.fullName).trim()) ||
      "";
    const studentNameEn =
      (u?.fullNameEn && String(u.fullNameEn).trim()) ||
      (snap?.fullNameEn && String(snap.fullNameEn).trim()) ||
      (u?.fullName && String(u.fullName).trim()) ||
      "";
    const rt = String(doc.resultType || "");
    const mt = String(doc.medalType || "");
    const rk = String(doc.rank || "");
    const effGrade = String(doc.effGrade || "");
    const effStage = String(doc.effStage || "unknown");
    const pendingReReview = doc.pendingReReview === true;
    const approvalKey = resolveWorkflowDisplayStatus({
      status: doc.status as string | undefined,
      isFeatured: doc.isFeatured === true,
      featured: doc.featured === true,
      approved: doc.approved === true,
      verificationStatus: doc.verificationStatus as string | undefined,
      pendingReReview,
    });
    const apprLabels: Record<string, { ar: string; en: string }> = {
      pending: { ar: "قيد المراجعة", en: "Pending" },
      pending_review: { ar: "قيد المراجعة", en: "Pending review" },
      needs_revision: { ar: "يحتاج تعديل", en: "Needs revision" },
      approved: { ar: "معتمد", en: "Approved" },
      featured: { ar: "مميز", en: "Featured" },
      rejected: { ar: "مرفوض", en: "Rejected" },
    };
    const al = apprLabels[approvalKey] || { ar: approvalKey, en: approvalKey };
    const rv = doc.resultValue;
    const scoreDisp =
      typeof rv === "number" && Number.isFinite(rv)
        ? String(rv)
        : typeof rv === "string" && rv.trim()
          ? rv.trim()
          : doc.giftedDiscoveryScore != null
            ? String(doc.giftedDiscoveryScore)
            : "";
    const scoreNumeric =
      typeof rv === "number" && Number.isFinite(rv)
        ? rv
        : typeof doc.giftedDiscoveryScore === "number" && Number.isFinite(doc.giftedDiscoveryScore as number)
          ? (doc.giftedDiscoveryScore as number)
          : null;
    const avatar = u?.profilePhoto && String(u.profilePhoto).trim() ? String(u.profilePhoto).trim() : "";
    return {
      achievementId: String(doc._id),
      studentNameAr: studentNameAr || "—",
      studentNameEn: studentNameEn || "—",
      studentAvatarUrl: avatar || undefined,
      gender: String(doc.effGender || ""),
      section: String(doc.effSection || ""),
      mawhiba: doc.effMawhiba === true,
      gradeLabelAr: getGradeLabel(effGrade, "ar"),
      gradeLabelEn: getGradeLabel(effGrade, "en"),
      stageKey: effStage,
      stageLabelAr: stageLabel(effStage, "ar"),
      stageLabelEn: stageLabel(effStage, "en"),
      schoolOrOrganization: String(doc.organization || "").trim() || "—",
      activityLabelAr: resolveParticipantActivityLabel(doc, "ar", {
        focusType,
        focusRaw,
        scopedLabelAr: opts?.activityLabelAr,
        scopedLabelEn: opts?.activityLabelEn,
      }),
      activityLabelEn: resolveParticipantActivityLabel(doc, "en", {
        focusType,
        focusRaw,
        scopedLabelAr: opts?.activityLabelAr,
        scopedLabelEn: opts?.activityLabelEn,
      }),
      year: typeof doc.effYear === "number" ? doc.effYear : null,
      resultLineAr: formatLocalizedResultLine(rt, mt, rk, "ar"),
      resultLineEn: formatLocalizedResultLine(rt, mt, rk, "en"),
      levelLabelAr: getAchievementLevelLabel(String(doc.achievementLevel || ""), "ar"),
      levelLabelEn: getAchievementLevelLabel(String(doc.achievementLevel || ""), "en"),
      scoreOrValueDisplay: scoreDisp || "—",
      scoreNumeric,
      approvalStatusKey: approvalKey,
      approvalLabelAr: al.ar,
      approvalLabelEn: al.en,
    };
  });

export type FocusedParticipantsFacetPayload = {
  participants: FocusedActivityParticipantRow[];
  page: number;
  pageSize: number;
  totalParticipants: number;
  participantsLightMode?: boolean;
  meta?: {
    approvedRecords: number;
    distinctStudents?: number;
  };
};

/** Paginated participants — paginate before lookup; no charts/insights/trends payloads. */
export const buildFocusedParticipantsPayload = async (input: {
  filters: ParticipationAnalyticsFilters;
  focusType: string;
  focusRaw: string;
  focusedOutcome: string;
  page?: number;
  pageSize?: number;
}): Promise<FocusedParticipantsFacetPayload> => {
  await connectDB();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, input.pageSize ?? 25));
  const skip = (page - 1) * pageSize;
  const focusType = String(input.focusType || "").trim();
  const focusRaw = String(input.focusRaw ?? "");
  const activityLabelAr = resolveAchievementActivityName(focusType, focusRaw, "ar", {
    fallbackRaw: focusRaw,
    allowUnspecified: false,
  });
  const activityLabelEn = resolveAchievementActivityName(focusType, focusRaw, "en", {
    fallbackRaw: focusRaw,
    allowUnspecified: false,
  });

  const prePagination = [
    ...buildParticipantsMiniShapedStages(input.filters),
    ...buildParticipantsFocusStages(focusType, focusRaw, input.focusedOutcome),
  ];

  const participantsPipeline = [
    ...prePagination,
    { $sort: { createdAt: -1 as const } },
    {
      $facet: {
        meta: [{ $count: "totalRecords" }],
        stats: [
          {
            $group: {
              _id: null,
              approvedRecords: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            },
          },
        ],
        rows: [{ $skip: skip }, { $limit: pageSize }, ...PARTICIPANTS_PAGE_LOOKUP],
      },
    },
  ] as mongoose.PipelineStage[];
  await maybeExplainFocusedPipeline(Achievement, participantsPipeline, {
    scope: "participants",
  });
  const [facetResult] = await Achievement.aggregate(participantsPipeline).allowDiskUse(true);

  const facet = (facetResult || {}) as {
    meta?: Array<{ totalRecords?: number }>;
    stats?: Array<{ approvedRecords?: number }>;
    rows?: Array<Record<string, unknown>>;
  };
  const totalRecords = Number(facet.meta?.[0]?.totalRecords ?? 0);
  const approvedRecords = Number(facet.stats?.[0]?.approvedRecords ?? 0);
  const participantsLightMode = totalRecords > PARTICIPANTS_LIGHT_MODE_THRESHOLD;
  const rowDocs = facet.rows ?? [];

  let distinctStudents: number | undefined;
  if (!participantsLightMode && totalRecords > 0) {
    const distinctRows = await Achievement.aggregate([
      ...prePagination,
      { $group: { _id: "$participantId" } },
      { $count: "distinctStudents" },
    ] as mongoose.PipelineStage[]).allowDiskUse(true);
    distinctStudents = Number(
      (distinctRows[0] as { distinctStudents?: number } | undefined)?.distinctStudents ?? 0
    );
  }

  return {
    participants: mapParticipantRowsFromDocs(rowDocs, focusType, focusRaw, {
      light: participantsLightMode,
      activityLabelAr,
      activityLabelEn,
    }),
    page,
    pageSize,
    totalParticipants: totalRecords,
    participantsLightMode,
    meta: {
      approvedRecords,
      ...(distinctStudents != null ? { distinctStudents } : {}),
    },
  };
};

export const parseFocusedParams = (sp: URLSearchParams) => ({
  filters: parseParticipationFiltersFromSearchParams(sp),
  focusType: String(sp.get("focusType") || "").trim(),
  focusRaw: sp.has("focusRaw") ? String(sp.get("focusRaw")) : "",
  focusedOutcome: String(sp.get("focusedOutcome") || "all").trim(),
  page: Math.max(1, parseInt(sp.get("page") || "1", 10) || 1),
  pageSize: Math.min(100, Math.max(5, parseInt(sp.get("pageSize") || "25", 10) || 25)),
  listOptions: sp.get("listOptions") === "1",
});

export type FocusedFacetScope =
  | "full"
  | "summary"
  | "participants"
  | "charts"
  | "trends"
  | "executive"
  | "insights"
  | "compare";

type FocusedBaseEnvelope = Pick<
  FocusedActivityReportPayload,
  "ok" | "generatedAt" | "filters" | "focusType" | "focusRaw" | "activityLabelAr" | "activityLabelEn" | "focusedOutcome"
>;

export const buildFocusedEnvelope = (input: {
  filters: ParticipationAnalyticsFilters;
  focusType: string;
  focusRaw: string;
  focusedOutcome: string;
}): FocusedBaseEnvelope => {
  const focusType = String(input.focusType || "").trim();
  const focusRaw = String(input.focusRaw ?? "");
  const outcome = String(input.focusedOutcome || "all").trim();
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    filters: input.filters,
    focusType,
    focusRaw,
    activityLabelAr: resolveAchievementActivityName(focusType, focusRaw, "ar"),
    activityLabelEn: resolveAchievementActivityName(focusType, focusRaw, "en"),
    focusedOutcome: outcome,
  };
};

/** Lean bounded ranking slice for weighted top performers (export/full bundle only). */
export const loadFocusedRankingPoolSlice = async (
  pipeline: FocusPipeline
): Promise<RankingPoolRow[]> => {
  const runtime = readFocusedRuntimeSnapshot();
  const docs = (await Achievement.aggregate([
    ...pipeline,
    {
      $project: {
        participantId: 1,
        resultType: 1,
        medalType: 1,
        rank: 1,
        achievementLevel: 1,
        organization: 1,
        effStage: 1,
        "u.fullNameAr": 1,
        "u.fullNameEn": 1,
        "u.fullName": 1,
        "u.profilePhoto": 1,
        "studentSnapshot.fullNameAr": 1,
        "studentSnapshot.fullNameEn": 1,
      },
    },
    { $limit: runtime.rankingPoolLimit },
  ] as mongoose.PipelineStage[])) as Array<Record<string, unknown>>;

  return docs.map((doc) => {
    const u = doc.u as {
      fullNameAr?: string;
      fullNameEn?: string;
      fullName?: string;
      profilePhoto?: string;
    } | undefined;
    const snap = doc.studentSnapshot as { fullNameAr?: string; fullNameEn?: string } | undefined;
    return {
      participantId: String(doc.participantId ?? ""),
      achievementId: String(doc._id ?? ""),
      resultType: String(doc.resultType || ""),
      medalType: String(doc.medalType || ""),
      rank: String(doc.rank || ""),
      achievementLevel: String(doc.achievementLevel || ""),
      nameAr: String(u?.fullNameAr || snap?.fullNameAr || u?.fullName || ""),
      nameEn: String(u?.fullNameEn || snap?.fullNameEn || u?.fullName || ""),
      school: String(doc.organization || ""),
      stage: String(doc.effStage || "unknown"),
      avatarUrl: u?.profilePhoto ? String(u.profilePhoto) : "",
    };
  });
};

/** Charts + demographics facet (no participant rows, no ranking pool). */
export const buildFocusedChartsPayload = async (
  input: {
    filters: ParticipationAnalyticsFilters;
    focusType: string;
    focusRaw: string;
    focusedOutcome: string;
  },
  pipeline: FocusPipeline
): Promise<FocusedActivityReportPayload["charts"]> => {
  const facetBody: Record<string, mongoose.PipelineStage[]> = {
    resultBars: [
      {
        $group: {
          _id: null,
          gold: { $sum: { $cond: [{ $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "gold"] }] }, 1, 0] } },
          silver: { $sum: { $cond: [{ $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "silver"] }] }, 1, 0] } },
          bronze: { $sum: { $cond: [{ $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "bronze"] }] }, 1, 0] } },
          nomination: { $sum: { $cond: [{ $eq: ["$resultType", "nomination"] }, 1, 0] } },
          rank: { $sum: { $cond: [{ $eq: ["$resultType", "rank"] }, 1, 0] } },
          participation: { $sum: { $cond: [{ $eq: ["$resultType", "participation"] }, 1, 0] } },
        },
      },
    ],
    genderPie: [{ $group: { _id: "$effGender", value: { $sum: 1 } } }],
    sectionPie: [{ $group: { _id: "$effSection", value: { $sum: 1 } } }],
    mawhibaPie: [{ $group: { _id: { $cond: ["$effMawhiba", "mawhiba", "non"] }, value: { $sum: 1 } } }],
    yearTrend: [
      {
        $group: {
          _id: "$effYear",
          records: { $sum: 1 },
          goldMedals: { $sum: { $cond: [{ $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "gold"] }] }, 1, 0] } },
          silverMedals: { $sum: { $cond: [{ $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "silver"] }] }, 1, 0] } },
          bronzeMedals: { $sum: { $cond: [{ $and: [{ $eq: ["$resultType", "medal"] }, { $eq: ["$medalType", "bronze"] }] }, 1, 0] } },
          totalMedals: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          maxLevelRank: { $max: "$levelRank" },
        },
      },
      { $sort: { _id: 1 } },
    ],
  };
  const [[facetResult], yearDistinctRows] = await Promise.all([
    Achievement.aggregate([...pipeline, { $facet: facetBody }] as mongoose.PipelineStage[]).allowDiskUse(true),
    Achievement.aggregate([
      ...pipeline,
      { $group: { _id: { y: "$effYear", p: "$participantId" } } },
      { $group: { _id: "$_id.y", distinctStudents: { $sum: 1 } } },
    ] as mongoose.PipelineStage[]).allowDiskUse(true),
  ]);
  const yearDistinctMap = new Map<number, number>();
  for (const row of yearDistinctRows as Array<{ _id: number; distinctStudents?: number }>) {
    if (typeof row._id === "number") yearDistinctMap.set(row._id, Number(row.distinctStudents || 0));
  }
  const rb = facetResult?.resultBars?.[0] as Record<string, number> | undefined;
  const resultBars = [
    { key: "gold", labelAr: "ذهبية", labelEn: "Gold", count: Number(rb?.gold || 0), fill: "#CA8A04" },
    { key: "silver", labelAr: "فضية", labelEn: "Silver", count: Number(rb?.silver || 0), fill: "#94A3B8" },
    { key: "bronze", labelAr: "برونزية", labelEn: "Bronze", count: Number(rb?.bronze || 0), fill: "#B45309" },
    { key: "nomination", labelAr: "ترشيح", labelEn: "Nomination", count: Number(rb?.nomination || 0), fill: "#7C3AED" },
    { key: "rank", labelAr: "مراكز", labelEn: "Ranks", count: Number(rb?.rank || 0), fill: "#0D9488" },
    { key: "participation", labelAr: "مشاركة", labelEn: "Participation", count: Number(rb?.participation || 0), fill: "#2563EB" },
  ];
  const genderPie = ((facetResult?.genderPie || []) as Array<{ _id: string; value: number }>).map((r) => ({
    name: r._id,
    nameAr: r._id === "female" ? "بنات" : "بنين",
    nameEn: r._id === "female" ? "Female" : "Male",
    value: r.value,
  }));
  const sectionPie = ((facetResult?.sectionPie || []) as Array<{ _id: string; value: number }>).map((r) => ({
    name: r._id,
    nameAr: r._id === "international" ? "دولي" : "عربي",
    nameEn: r._id === "international" ? "International" : "Arabic",
    value: r.value,
  }));
  const mawhibaPie = ((facetResult?.mawhibaPie || []) as Array<{ _id: string; value: number }>).map((r) => ({
    name: r._id,
    nameAr: r._id === "mawhiba" ? "موهبة" : "غير موهبة",
    nameEn: r._id === "mawhiba" ? "Mawhiba" : "Non‑Mawhiba",
    value: r.value,
  }));
  const yRaw = (facetResult?.yearTrend || []) as Array<{
    _id: number;
    records?: number;
    goldMedals?: number;
    silverMedals?: number;
    bronzeMedals?: number;
    totalMedals?: number;
    approved?: number;
    maxLevelRank?: number;
  }>;
  const yearTrend = yRaw
    .filter((y) => typeof y._id === "number" && y._id >= 1990)
    .map((y) => {
      const rec = Number(y.records || 0);
      const appr = Number(y.approved || 0);
      const mr = Number(y.maxLevelRank ?? 2);
      const lk = levelKeyFromMaxRank(mr);
      const yearNum = Number(y._id);
      return {
        year: yearNum,
        records: rec,
        distinctStudents: yearDistinctMap.get(yearNum) ?? 0,
        goldMedals: Number(y.goldMedals || 0),
        silverMedals: Number(y.silverMedals || 0),
        bronzeMedals: Number(y.bronzeMedals || 0),
        totalMedals: Number(y.totalMedals || 0),
        excellenceRatePct: rec > 0 ? Math.round((appr / rec) * 1000) / 10 : 0,
        maxLevelRank: mr,
        topLevelLabelAr: getAchievementLevelLabel(lk, "ar"),
        topLevelLabelEn: getAchievementLevelLabel(lk, "en"),
      };
    });
  void input;
  return sanitizeFocusedChartsPayload({ resultBars, genderPie, sectionPie, mawhibaPie, yearTrend });
};

export const buildFocusedExecutivePayload = async (
  input: {
    filters: ParticipationAnalyticsFilters;
    focusType: string;
    focusRaw: string;
    focusedOutcome: string;
  },
  pipeline: FocusPipeline,
  kpi: Awaited<ReturnType<typeof aggregateFocusedKpiMetrics>>,
  charts: FocusedActivityReportPayload["charts"]
): Promise<FocusedActivityReportPayload["executive"]> => {
  const [facetResult] = await Achievement.aggregate([
    ...pipeline,
    {
      $facet: {
        sectionByGender: [{ $group: { _id: { s: "$effSection", g: "$effGender" }, value: { $sum: 1 } } }],
        stageCounts: [{ $group: { _id: "$effStage", value: { $sum: 1 } } }],
        mawhibaByGender: [{ $group: { _id: { m: "$effMawhiba", g: "$effGender" }, value: { $sum: 1 } } }],
        topByParticipation: [
          {
            $group: {
              _id: "$participantId",
              recordCount: { $sum: 1 },
              medalCount: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
              maxLevelRank: { $max: "$levelRank" },
              nameAr: { $first: { $ifNull: ["$u.fullNameAr", { $ifNull: ["$studentSnapshot.fullNameAr", ""] }] } },
              nameEn: { $first: { $ifNull: ["$u.fullNameEn", { $ifNull: ["$studentSnapshot.fullNameEn", ""] }] } },
              school: { $first: { $ifNull: ["$organization", ""] } },
              stage: { $first: "$effStage" },
              avatarUrl: { $first: { $ifNull: ["$u.profilePhoto", ""] } },
            },
          },
          { $sort: { recordCount: -1 } },
          { $limit: 8 },
        ],
        topByMedals: [
          {
            $group: {
              _id: "$participantId",
              recordCount: { $sum: 1 },
              medalCount: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
              maxLevelRank: { $max: "$levelRank" },
              nameAr: { $first: { $ifNull: ["$u.fullNameAr", ""] } },
              nameEn: { $first: { $ifNull: ["$u.fullNameEn", ""] } },
              school: { $first: { $ifNull: ["$organization", ""] } },
              stage: { $first: "$effStage" },
              avatarUrl: { $first: { $ifNull: ["$u.profilePhoto", ""] } },
            },
          },
          { $sort: { medalCount: -1, recordCount: -1 } },
          { $limit: 8 },
        ],
        topByLevel: [
          {
            $group: {
              _id: "$participantId",
              recordCount: { $sum: 1 },
              medalCount: { $sum: { $cond: [{ $eq: ["$resultType", "medal"] }, 1, 0] } },
              maxLevelRank: { $max: "$levelRank" },
              nameAr: { $first: { $ifNull: ["$u.fullNameAr", ""] } },
              nameEn: { $first: { $ifNull: ["$u.fullNameEn", ""] } },
              school: { $first: { $ifNull: ["$organization", ""] } },
              stage: { $first: "$effStage" },
              avatarUrl: { $first: { $ifNull: ["$u.profilePhoto", ""] } },
            },
          },
          { $sort: { maxLevelRank: -1, medalCount: -1, recordCount: -1 } },
          { $limit: 8 },
        ],
      },
    },
  ] as mongoose.PipelineStage[]).allowDiskUse(true);

  const rb = charts.resultBars;
  const gold = rb.find((x) => x.key === "gold")?.count ?? 0;
  const silver = rb.find((x) => x.key === "silver")?.count ?? 0;
  const bronze = rb.find((x) => x.key === "bronze")?.count ?? 0;
  const totalMedalsAll = gold + silver + bronze;
  const ytSorted = [...charts.yearTrend].sort((a, b) => a.year - b.year);
  const yCurr = ytSorted.length ? ytSorted[ytSorted.length - 1]! : null;
  const yPrev = ytSorted.length >= 2 ? ytSorted[ytSorted.length - 2]! : null;

  type TopAgg = {
    _id: unknown;
    recordCount?: number;
    medalCount?: number;
    maxLevelRank?: number;
    nameAr?: string;
    nameEn?: string;
    school?: string;
    stage?: string;
    avatarUrl?: string;
  };
  const mapTop = (rows: TopAgg[]) =>
    rows.map((r) => ({
      participantId: String(r._id ?? ""),
      nameAr: String(r.nameAr || "").trim() || "—",
      nameEn: String(r.nameEn || "").trim() || "—",
      recordCount: Number(r.recordCount || 0),
      medalCount: Number(r.medalCount || 0),
      maxLevelRank: Number(r.maxLevelRank ?? 2),
      school: String(r.school || "").trim() || "—",
      stageKey: String(r.stage || "unknown"),
      stageLabelAr: stageLabel(String(r.stage || "unknown"), "ar"),
      stageLabelEn: stageLabel(String(r.stage || "unknown"), "en"),
      avatarUrl: r.avatarUrl ? String(r.avatarUrl).trim() : "",
    }));

  const topByParticipation = mapTop((facetResult?.topByParticipation || []) as TopAgg[]);
  const topByMedals = mapTop((facetResult?.topByMedals || []) as TopAgg[]);
  const topByLevel = mapTop((facetResult?.topByLevel || []) as TopAgg[]);

  const sectionGenderRaw = (facetResult?.sectionByGender || []) as Array<{
    _id: { s: string; g: string };
    value: number;
  }>;
  const secAr = { male: 0, female: 0 };
  const secIntl = { male: 0, female: 0 };
  for (const row of sectionGenderRaw) {
    const s = row._id?.s === "international" ? "intl" : "ar";
    const g = row._id?.g === "female" ? "female" : "male";
    const v = Number(row.value || 0);
    if (s === "intl") {
      if (g === "female") secIntl.female += v;
      else secIntl.male += v;
    } else {
      if (g === "female") secAr.female += v;
      else secAr.male += v;
    }
  }
  const stageRaw = (facetResult?.stageCounts || []) as Array<{ _id: string; value: number }>;
  const stageBreakdown = stageRaw
    .filter((r) => r._id && r._id !== "unknown")
    .map((r) => ({
      stageKey: String(r._id),
      count: Number(r.value || 0),
      labelAr: stageLabel(String(r._id), "ar"),
      labelEn: stageLabel(String(r._id), "en"),
    }))
    .sort((a, b) => b.count - a.count);
  const mhGRaw = (facetResult?.mawhibaByGender || []) as Array<{ _id: { m: boolean; g: string }; value: number }>;
  const mawSeg = { mawhiba: { male: 0, female: 0 }, non: { male: 0, female: 0 } };
  for (const row of mhGRaw) {
    const bucket = row._id?.m === true ? "mawhiba" : "non";
    const g = row._id?.g === "female" ? "female" : "male";
    mawSeg[bucket][g] += Number(row.value || 0);
  }

  void input;
  return {
    kpiCards: [
      {
        id: "records",
        icon: "📊",
        tone: "sky" as const,
        labelAr: "إجمالي السجلات",
        labelEn: "Total records",
        value: String(kpi.totalRecords),
        hintAr: yPrev ? `مقارنة ب${yPrev.year}` : "ضمن نطاق الفلاتر",
        hintEn: yPrev ? `Vs ${yPrev.year}` : "Within filter scope",
        trendPct: pctChange(yCurr?.records ?? 0, yPrev?.records),
        trendDir: trendDir(pctChange(yCurr?.records ?? 0, yPrev?.records)),
      },
      {
        id: "students",
        icon: "👥",
        tone: "violet" as const,
        labelAr: "الطلاب المشاركون",
        labelEn: "Participating students",
        value: String(kpi.distinctStudents),
        hintAr: yCurr ? `عام ${yCurr.year}` : "حسب هوية المتعلم",
        hintEn: yCurr ? `Year ${yCurr.year}` : "Unique learners",
        trendPct: pctChange(yCurr?.distinctStudents ?? 0, yPrev?.distinctStudents),
        trendDir: trendDir(pctChange(yCurr?.distinctStudents ?? 0, yPrev?.distinctStudents)),
      },
      {
        id: "gold",
        icon: "🥇",
        tone: "amber" as const,
        labelAr: "الميداليات الذهبية",
        labelEn: "Gold medals",
        value: String(gold),
        hintAr: "في نطاق النشاط والفلاتر",
        hintEn: "Activity scope",
        trendPct: pctChange(yCurr?.goldMedals ?? 0, yPrev?.goldMedals),
        trendDir: trendDir(pctChange(yCurr?.goldMedals ?? 0, yPrev?.goldMedals)),
      },
      {
        id: "medals",
        icon: "🏅",
        tone: "emerald" as const,
        labelAr: "إجمالي الميداليات",
        labelEn: "Total medals",
        value: String(totalMedalsAll),
        hintAr: "ذهبية + فضية + برونزية",
        hintEn: "Gold + silver + bronze",
        trendPct: pctChange(yCurr?.totalMedals ?? 0, yPrev?.totalMedals),
        trendDir: trendDir(pctChange(yCurr?.totalMedals ?? 0, yPrev?.totalMedals)),
      },
      {
        id: "excellence",
        icon: "✅",
        tone: "slate" as const,
        labelAr: "نسبة الاعتماد",
        labelEn: "Approval rate",
        value: `${kpi.excellenceRatePct}%`,
        hintAr: "معتمد ÷ إجمالي السجلات",
        hintEn: "Approved ÷ records",
        trendPct: pctChange(yCurr?.excellenceRatePct ?? 0, yPrev?.excellenceRatePct),
        trendDir: trendDir(pctChange(yCurr?.excellenceRatePct ?? 0, yPrev?.excellenceRatePct)),
      },
    ],
    yearComparison: ytSorted.slice(-4),
    demographicStacks: {
      sectionGender: [
        { key: "arabic", labelAr: "عربي", labelEn: "Arabic", male: secAr.male, female: secAr.female },
        { key: "international", labelAr: "دولي", labelEn: "International", male: secIntl.male, female: secIntl.female },
      ],
      stageBreakdown,
      mawhibaGender: [
        { key: "mawhiba", labelAr: "موهبة", labelEn: "Mawhiba", male: mawSeg.mawhiba.male, female: mawSeg.mawhiba.female },
        { key: "non", labelAr: "غير موهبة", labelEn: "Non‑Mawhiba", male: mawSeg.non.male, female: mawSeg.non.female },
      ],
    },
    topPerformers: {
      byWeighted: topByMedals,
      byParticipation: topByParticipation,
      byMedals: topByMedals,
      byLevel: topByLevel,
    },
  };
};

/**
 * Faceted focused analytics — no full-payload fallback for UI scopes (export uses scope=full).
 */
export const buildFocusedActivityFacet = async (input: {
  scope: FocusedFacetScope;
  filters: ParticipationAnalyticsFilters;
  focusType: string;
  focusRaw: string;
  focusedOutcome: string;
  page?: number;
  pageSize?: number;
}): Promise<FocusedActivityReportPayload | (FocusedBaseEnvelope & Record<string, unknown>)> => {
  const aggT0 = Date.now();
  logFocusedAggregationStart(input.scope);

  if (input.scope === "full") {
    const { buildFocusedExecutiveBundle } = await import("@/lib/analytics/focused-executive-bundle");
    const payload = await buildFocusedExecutiveBundle(input);
    recordFocusedAggregationTiming({
      scope: "full",
      durationMs: Date.now() - aggT0,
      rowCount: payload.participants?.length,
    });
    return payload;
  }

  await connectDB();
  const base = buildFocusedEnvelope(input);
  const { pipeline } = buildFocusPipeline(input);
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, input.pageSize ?? 25));

  if (input.scope === "summary") {
    const kpi = await aggregateFocusedKpiMetrics(pipeline);
    recordFocusedAggregationTiming({ scope: "summary", durationMs: Date.now() - aggT0 });
    return {
      ...base,
      scope: "summary",
      kpis: {
        totalRecords: kpi.totalRecords,
        distinctStudents: kpi.distinctStudents,
        approvedRecords: kpi.approvedRecords,
        excellenceRatePct: kpi.excellenceRatePct,
      },
    };
  }

  if (input.scope === "participants") {
    const part = await buildFocusedParticipantsPayload({
      filters: input.filters,
      focusType: input.focusType,
      focusRaw: input.focusRaw,
      focusedOutcome: input.focusedOutcome,
      page,
      pageSize,
    });
    recordFocusedAggregationTiming({ scope: "participants", durationMs: Date.now() - aggT0, rowCount: part.participants.length });
    return {
      ok: true,
      generatedAt: base.generatedAt,
      filters: base.filters,
      focusType: base.focusType,
      focusRaw: base.focusRaw,
      activityLabelAr: base.activityLabelAr,
      activityLabelEn: base.activityLabelEn,
      focusedOutcome: base.focusedOutcome,
      scope: "participants",
      participants: part.participants,
      page: part.page,
      pageSize: part.pageSize,
      totalParticipants: part.totalParticipants,
      participantsLightMode: part.participantsLightMode,
      meta: part.meta,
    };
  }

  const kpi = await aggregateFocusedKpiMetrics(pipeline);
  const charts = await buildFocusedChartsPayload(input, pipeline);

  if (input.scope === "charts") {
    recordFocusedAggregationTiming({ scope: "charts", durationMs: Date.now() - aggT0 });
    return { ...base, scope: "charts", charts };
  }

  if (input.scope === "trends") {
    const executive = await buildFocusedExecutivePayload(input, pipeline, kpi, charts);
    recordFocusedAggregationTiming({ scope: "trends", durationMs: Date.now() - aggT0 });
    return {
      ...base,
      scope: "trends",
      charts: { yearTrend: charts.yearTrend },
      executive: { yearComparison: executive.yearComparison },
    };
  }

  const executive = await buildFocusedExecutivePayload(input, pipeline, kpi, charts);

  if (input.scope === "executive") {
    recordFocusedAggregationTiming({ scope: "executive", durationMs: Date.now() - aggT0 });
    return { ...base, scope: "executive", executive };
  }

  if (input.scope === "compare") {
    recordFocusedAggregationTiming({ scope: "compare", durationMs: Date.now() - aggT0 });
    return {
      ...base,
      scope: "compare",
      executive,
      kpis: {
        totalRecords: kpi.totalRecords,
        distinctStudents: kpi.distinctStudents,
        approvedRecords: kpi.approvedRecords,
        excellenceRatePct: kpi.excellenceRatePct,
      },
      charts: { resultBars: charts.resultBars },
    };
  }

  if (input.scope === "insights") {
    const ytSorted = [...charts.yearTrend].sort((a, b) => a.year - b.year);
    const yCurr = ytSorted.length ? ytSorted[ytSorted.length - 1]! : null;
    const yPrev = ytSorted.length >= 2 ? ytSorted[ytSorted.length - 2]! : null;
    const rb = charts.resultBars;
    const gold = rb.find((x) => x.key === "gold")?.count ?? 0;
    const silver = rb.find((x) => x.key === "silver")?.count ?? 0;
    const bronze = rb.find((x) => x.key === "bronze")?.count ?? 0;
    const peerRows = await loadPeerActivityMetrics(input.filters);
    const activityLabelAr = resolveAchievementActivityName(input.focusType, input.focusRaw, "ar");
    const activityLabelEn = resolveAchievementActivityName(input.focusType, input.focusRaw, "en");
    const decisionPlatform = buildCompetitionDecisionPlatform({
      activityLabelAr,
      activityLabelEn,
      focusType: input.focusType,
      focusRaw: input.focusRaw,
      totalRecords: kpi.totalRecords,
      distinctStudents: kpi.distinctStudents,
      approvedRecords: kpi.approvedRecords,
      excellenceRatePct: kpi.excellenceRatePct,
      gold,
      silver,
      bronze,
      nomination: rb.find((x) => x.key === "nomination")?.count ?? 0,
      participation: rb.find((x) => x.key === "participation")?.count ?? 0,
      executive,
      yCurr,
      yPrev,
      peerRows,
    });
    recordFocusedAggregationTiming({ scope: "insights", durationMs: Date.now() - aggT0 });
    return { ...base, scope: "insights", decisionPlatform };
  }

  recordFocusedAggregationTiming({ scope: input.scope, durationMs: Date.now() - aggT0 });
  return { ...base, scope: input.scope };
};
