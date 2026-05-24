/**
 * Aggregated achievement statistics for admin dashboards and AI-assisted reports.
 */

import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { DUPLICATE_FLAG } from "@/lib/achievement-review-rules";
import { buildAdminAchievementListFilter } from "@/lib/adminAchievementListQuery";
import {
  getAchievementDisplayName,
  getAchievementLevelLabel,
  labelAchievementCategory,
  safeTrim as displaySafeTrim,
} from "@/lib/achievementDisplay";
import {
  getAchievementEventOrSlugLabel,
  getAchievementFieldLabel,
  getAchievementResultLabel,
  getAchievementTypeLabel,
  getParticipationTypeLabel,
  getWorkflowStatusLabel,
} from "@/lib/achievement-display-labels";
import { getStageByGrade, reportStageLabel, type ReportStage } from "@/lib/report-stage-mapping";
import {
  REPORT_LEVEL_VALUES,
  REPORT_RESULT_TOKEN_VALUES,
  resultTokenToMongoCondition,
} from "@/lib/report-filter-options";
import {
  buildReportCategoriesMongoFilter,
  EXTENDED_REPORT_CATEGORY_SET,
  resolveStoredAchievementReportCategory,
} from "@/lib/achievement-report-category";
import {
  resolveCanonicalActivity,
  normalizeAchievementActivityName,
} from "@/lib/analytics/activity-name-normalizer";
import {
  extractActivityYearFromAchievement,
  dedupeActivityYears,
  buildActivityYearLabel,
} from "@/lib/analytics/activity-year-resolver";
import { resolveAchievementResultDisplay } from "@/lib/standardized-tests/resolve-achievement-result-display";
import { resolveAchievementOutcome } from "@/lib/analytics/achievement-outcome-resolver";
import {
  resolveStandardizedComparableScore,
  resolveStandardizedTestType,
} from "@/lib/standardized-tests/standardized-test-rules";
import {
  ACTIVITY_REGISTRY_GROUP_LABELS,
  type ActivityRegistryCategory,
} from "@/constants/achievement-competition-registry";
import {
  buildMultiFilterMongoQuery,
  resolveReportMultiFilters,
} from "@/lib/analytics/multi-filter-utils";

const safeStr = (v: unknown) => String(v ?? "").trim();

export type CountByKey = Record<string, number>;

const countBy = (rows: Record<string, unknown>[], key: string): CountByKey => {
  const out: CountByKey = {};
  for (const r of rows) {
    const k = safeStr(r[key]) || "—";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
};

const topN = (m: CountByKey, n: number): Array<{ key: string; count: number }> =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));

const labelCountMap = (
  m: CountByKey,
  label: (k: string, loc: "ar" | "en") => string
): Array<{ key: string; count: number; labelAr: string; labelEn: string }> =>
  Object.entries(m).map(([key, count]) => ({
    key,
    count,
    labelAr: key === "—" ? (label("—", "ar") || "غير محدد") : label(key, "ar"),
    labelEn: key === "—" ? (label("—", "en") || "Not specified") : label(key, "en"),
  }));

export const buildAllAchievementsReportStats = async (): Promise<Record<string, unknown>> => {
  await connectDB();
  const rows = await Achievement.find({})
    .select(
      "userId achievementType inferredField achievementLevel status verificationStatus evidenceMatchStatus aiFlags achievementYear achievementName adminAttachmentAiReview"
    )
    .lean();

  const list = rows as unknown as Record<string, unknown>[];
  const total = list.length;
  const studentIds = new Set<string>();
  for (const r of list) {
    const uid = r.userId;
    if (uid) studentIds.add(String(uid));
  }

  const byType = countBy(list, "achievementType");
  const byField = countBy(list, "inferredField");
  const byLevel = countBy(list, "achievementLevel");
  const byStatus = countBy(list, "status");

  let mismatchEvidence = 0;
  let committeePending = 0;
  let duplicateFlagged = 0;
  let attachmentMismatchHint = 0;

  for (const r of list) {
    if (r.evidenceMatchStatus === "mismatched") mismatchEvidence++;
    if (r.verificationStatus === "mismatch") mismatchEvidence++;
    if (r.verificationStatus === "pending_committee_review") committeePending++;
    const flags = r.aiFlags;
    if (Array.isArray(flags) && flags.includes(DUPLICATE_FLAG)) duplicateFlagged++;
    const ar = r.adminAttachmentAiReview as Record<string, unknown> | undefined;
    if (ar && ar.overallMatchStatus === "mismatch") attachmentMismatchHint++;
  }

  const byYear = countBy(
    list.map((r) => ({ ...r, achievementYear: String(r.achievementYear ?? "") })),
    "achievementYear"
  );

  const nameCounts: CountByKey = {};
  for (const r of list) {
    const n = safeStr(r.achievementName) || "—";
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  }

  return {
    scope: "all",
    totalAchievements: total,
    distinctStudents: studentIds.size,
    averageAchievementsPerStudent:
      studentIds.size > 0 ? Math.round((total / studentIds.size) * 100) / 100 : 0,
    byType,
    byField,
    byLevel,
    byStatus,
    byYear,
    byTypeLabeled: labelCountMap(byType, (k, loc) => getAchievementTypeLabel(k, loc)),
    byFieldLabeled: labelCountMap(byField, (k, loc) => getAchievementFieldLabel(k, loc)),
    byLevelLabeled: labelCountMap(byLevel, (k, loc) => getAchievementLevelLabel(k, loc)),
    byStatusLabeled: labelCountMap(byStatus, (k, loc) => getWorkflowStatusLabel(k, loc)),
    topAchievementNames: topN(nameCounts, 12).map((x) => ({
      ...x,
      labelAr: x.key === "—" ? "غير محدد" : getAchievementEventOrSlugLabel(x.key, "ar"),
      labelEn: x.key === "—" ? "Not specified" : getAchievementEventOrSlugLabel(x.key, "en"),
    })),
    reviewSignals: {
      mismatchOrVerificationIssues: mismatchEvidence,
      pendingCommitteeReview: committeePending,
      duplicateFlaggedCount: duplicateFlagged,
      attachmentAiMismatchCount: attachmentMismatchHint,
    },
  };
};

export const buildStudentAchievementReportStats = async (
  userId: string
): Promise<Record<string, unknown> | null> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  await connectDB();
  const uid = new mongoose.Types.ObjectId(userId);

  const user = await User.findById(uid)
    .select("fullName fullNameAr fullNameEn email grade section studentId isMawhibaStudent")
    .lean();
  if (!user) return null;

  const u = user as unknown as Record<string, unknown>;
  const rows = await Achievement.find({ userId: uid })
    .select(
      "achievementType inferredField achievementLevel status resultType medalType rank score achievementName achievementYear verificationStatus evidenceMatchStatus aiFlags adminAttachmentAiReview"
    )
    .lean();

  const list = rows as unknown as Record<string, unknown>[];
  const total = list.length;

  let highLevel = 0;
  for (const r of list) {
    const lv = safeStr(r.achievementLevel).toLowerCase();
    if (lv === "kingdom" || lv === "international") highLevel++;
  }

  const medals = list.filter((r) => safeStr(r.resultType) === "medal").length;
  const ranks = list.filter((r) => safeStr(r.resultType) === "rank").length;

  let dupFlags = 0;
  let attachMismatch = 0;
  for (const r of list) {
    const flags = r.aiFlags;
    if (Array.isArray(flags) && flags.includes(DUPLICATE_FLAG)) dupFlags++;
    const ar = r.adminAttachmentAiReview as Record<string, unknown> | undefined;
    if (ar && ar.overallMatchStatus === "mismatch") attachMismatch++;
  }

  const topScores = [...list]
    .filter((r) => typeof r.score === "number")
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 5)
    .map((r) => {
      const rawTitle = safeStr(r.achievementName);
      return {
        title: rawTitle,
        titleLabelAr: rawTitle ? getAchievementEventOrSlugLabel(rawTitle, "ar") : "غير محدد",
        titleLabelEn: rawTitle ? getAchievementEventOrSlugLabel(rawTitle, "en") : "Not specified",
        score: r.score,
        year: r.achievementYear,
      };
    });

  const byTypeS = countBy(list, "achievementType");
  const byFieldS = countBy(list, "inferredField");
  const byLevelS = countBy(list, "achievementLevel");
  const byStatusS = countBy(list, "status");

  return {
    scope: "student",
    student: {
      id: userId,
      fullName: safeStr(u.fullName || u.fullNameAr),
      grade: safeStr(u.grade),
      section: safeStr(u.section),
      studentId: safeStr(u.studentId),
      isMawhibaStudent: u.isMawhibaStudent === true,
    },
    totalAchievements: total,
    byType: byTypeS,
    byField: byFieldS,
    byLevel: byLevelS,
    byStatus: byStatusS,
    byTypeLabeled: labelCountMap(byTypeS, (k, loc) => getAchievementTypeLabel(k, loc)),
    byFieldLabeled: labelCountMap(byFieldS, (k, loc) => getAchievementFieldLabel(k, loc)),
    byLevelLabeled: labelCountMap(byLevelS, (k, loc) => getAchievementLevelLabel(k, loc)),
    byStatusLabeled: labelCountMap(byStatusS, (k, loc) => getWorkflowStatusLabel(k, loc)),
    highlights: {
      highLevelKingdomOrIntl: highLevel,
      medalResults: medals,
      rankResults: ranks,
      topScores,
    },
    reviewSignals: {
      duplicateFlaggedCount: dupFlags,
      attachmentAiMismatchCount: attachMismatch,
    },
  };
};

export const buildFieldAchievementReportStats = async (
  fieldSlug: string
): Promise<Record<string, unknown> | null> => {
  const f = safeStr(fieldSlug);
  if (!f) return null;
  await connectDB();

  const rows = await Achievement.find({ inferredField: f })
    .select(
      "userId achievementType achievementLevel status resultType achievementName score achievementYear verificationStatus adminAttachmentAiReview"
    )
    .lean();

  const list = rows as unknown as Record<string, unknown>[];
  const studentIds = new Set<string>();
  for (const r of list) {
    if (r.userId) studentIds.add(String(r.userId));
  }

  const nameCounts: CountByKey = {};
  for (const r of list) {
    const n = safeStr(r.achievementName) || "—";
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  }

  const byResult = countBy(list, "resultType");
  const byTypeF = countBy(list, "achievementType");
  const byLevelF = countBy(list, "achievementLevel");
  const byStatusF = countBy(list, "status");

  return {
    scope: "field",
    field: f,
    fieldLabelAr: getAchievementFieldLabel(f, "ar"),
    fieldLabelEn: getAchievementFieldLabel(f, "en"),
    totalAchievements: list.length,
    distinctStudents: studentIds.size,
    byType: byTypeF,
    byLevel: byLevelF,
    byStatus: byStatusF,
    byTypeLabeled: labelCountMap(byTypeF, (k, loc) => getAchievementTypeLabel(k, loc)),
    byLevelLabeled: labelCountMap(byLevelF, (k, loc) => getAchievementLevelLabel(k, loc)),
    byStatusLabeled: labelCountMap(byStatusF, (k, loc) => getWorkflowStatusLabel(k, loc)),
    byResultType: byResult,
    byResultTypeLabeled: labelCountMap(byResult, (k, loc) =>
      getAchievementResultLabel({ resultType: k }, loc)
    ),
    topAchievementNames: topN(nameCounts, 15).map((x) => ({
      ...x,
      labelAr: x.key === "—" ? "غير محدد" : getAchievementEventOrSlugLabel(x.key, "ar"),
      labelEn: x.key === "—" ? "Not specified" : getAchievementEventOrSlugLabel(x.key, "en"),
    })),
  };
};

export const buildCompetitionAchievementReportStats = async (
  competitionKey: string
): Promise<Record<string, unknown> | null> => {
  const key = safeStr(competitionKey);
  if (!key) return null;
  await connectDB();

  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rows = await Achievement.find({
    achievementName: new RegExp(`^${esc}$`, "i"),
  })
    .select(
      "userId achievementType inferredField achievementLevel status resultType medalType rank achievementName achievementYear verificationStatus evidenceMatchStatus aiFlags adminAttachmentAiReview"
    )
    .lean();

  const list = rows as unknown as Record<string, unknown>[];
  const studentIds = new Set<string>();
  for (const r of list) {
    if (r.userId) studentIds.add(String(r.userId));
  }

  let dup = 0;
  let attachBad = 0;
  for (const r of list) {
    const flags = r.aiFlags;
    if (Array.isArray(flags) && flags.includes(DUPLICATE_FLAG)) dup++;
    const ar = r.adminAttachmentAiReview as Record<string, unknown> | undefined;
    if (ar && (ar.overallMatchStatus === "mismatch" || ar.overallMatchStatus === "unclear"))
      attachBad++;
  }

  const byFieldC = countBy(list, "inferredField");
  const byLevelC = countBy(list, "achievementLevel");
  const byStatusC = countBy(list, "status");
  const byResultC = countBy(list, "resultType");
  const byMedalC = countBy(list, "medalType");

  return {
    scope: "competition",
    competitionKey: key,
    competitionLabelAr: getAchievementEventOrSlugLabel(key, "ar"),
    competitionLabelEn: getAchievementEventOrSlugLabel(key, "en"),
    totalRows: list.length,
    distinctStudents: studentIds.size,
    byField: byFieldC,
    byLevel: byLevelC,
    byStatus: byStatusC,
    byResultType: byResultC,
    byMedal: byMedalC,
    byFieldLabeled: labelCountMap(byFieldC, (k, loc) => getAchievementFieldLabel(k, loc)),
    byLevelLabeled: labelCountMap(byLevelC, (k, loc) => getAchievementLevelLabel(k, loc)),
    byStatusLabeled: labelCountMap(byStatusC, (k, loc) => getWorkflowStatusLabel(k, loc)),
    byResultTypeLabeled: labelCountMap(byResultC, (k, loc) =>
      getAchievementResultLabel({ resultType: k }, loc)
    ),
    byMedalLabeled: labelCountMap(byMedalC, (k, loc) =>
      getAchievementResultLabel({ resultType: "medal", medalType: k }, loc)
    ),
    reviewSignals: {
      duplicateFlaggedCount: dup,
      attachmentIssuesCount: attachBad,
    },
    sampleIds: list.slice(0, 30).map((r) => String(r._id)),
  };
};

export const buildUrgentReviewQueueStats = async (): Promise<Record<string, unknown>> => {
  await connectDB();
  const pending = await Achievement.countDocuments({
    status: { $in: ["pending", "pending_review"] },
  });
  const needsRev = await Achievement.countDocuments({ status: "needs_revision" });
  const mismatch = await Achievement.countDocuments({
    $or: [{ verificationStatus: "mismatch" }, { evidenceMatchStatus: "mismatched" }],
  });
  const dup = await Achievement.countDocuments({ aiFlags: DUPLICATE_FLAG });

  return {
    scope: "urgent_queue",
    pending,
    needsRevision: needsRev,
    verificationOrEvidenceMismatch: mismatch,
    duplicateFlagged: dup,
  };
};

export type AdminReportFilters = {
  academicYear?: string;
  gender?: string;
  /** all | yes | no — Mawhiba (gifted) class students vs others. */
  mawhiba?: string;
  stage?: string;
  grade?: string;
  /** @deprecated prefer `categories` */
  category?: string;
  /** Empty array = الكل (no filter). */
  categories?: string[];
  achievementName?: string;
  /** When true, keep one row per student + canonical activity. */
  uniqueParticipantsOnly?: boolean;
  /** Standardized test score range (applies to rows with comparable scores). */
  scoreMin?: number;
  scoreMax?: number;
  /** @deprecated prefer `levels` */
  level?: string;
  /** Empty array = الكل */
  levels?: string[];
  /** @deprecated prefer `resultTokens` */
  result?: string;
  /** Encoded tokens: participation, medal:gold, rank:first, … Empty = الكل */
  resultTokens?: string[];
  status?: string;
  certificateStatus?: string;
  /** Filter by resolved activity year (e.g. 2025). Omit or "all" = no filter. */
  filterActivityYear?: number | string;
  /** Multi activity years (CSV: activityYears=2025,2026). */
  activityYears?: (number | string)[];
  /** Multi canonical activity keys (CSV: achievementNames=bebras,kangaroo). */
  achievementNames?: string[];
  stages?: string[];
  grades?: string[];
  genders?: string[];
  mawhibaValues?: string[];
  statuses?: string[];
  certificateStatuses?: string[];
  standardizedTestTypes?: string[];
  fromDate?: string;
  toDate?: string;
};

const ALLOW_CATEGORY = EXTENDED_REPORT_CATEGORY_SET;
const ALLOW_LEVEL = new Set<string>([...REPORT_LEVEL_VALUES]);
const ALLOW_RESULT = new Set<string>(REPORT_RESULT_TOKEN_VALUES);

const normalizeReportCategories = (f: AdminReportFilters): string[] => {
  const raw =
    f.categories && f.categories.length > 0
      ? f.categories
      : f.category && f.category !== "all"
        ? [f.category]
        : [];
  return raw.map((x) => String(x).trim()).filter((x) => ALLOW_CATEGORY.has(x));
};

const normalizeReportLevels = (f: AdminReportFilters): string[] => {
  const raw =
    f.levels && f.levels.length > 0 ? f.levels : f.level && f.level !== "all" ? [f.level] : [];
  return raw.map((x) => String(x).trim()).filter((x) => ALLOW_LEVEL.has(x));
};

const normalizeReportResultTokens = (f: AdminReportFilters): string[] => {
  const raw =
    f.resultTokens && f.resultTokens.length > 0
      ? f.resultTokens
      : f.result && f.result !== "all"
        ? [f.result]
        : [];
  return raw.map((x) => String(x).trim()).filter((x) => ALLOW_RESULT.has(x));
};

export type AdminReportRow = {
  id: string;
  studentId: string;
  studentName: string;
  gender: string;
  grade: string;
  isMawhibaStudent: boolean;
  stage: ReportStage;
  stageLabelAr: string;
  stageLabelEn: string;
  categoryLabelAr: string;
  categoryLabelEn: string;
  eventLabelAr: string;
  eventLabelEn: string;
  analyticsActivityKey: string;
  analyticsActivityDisplayAr: string;
  analyticsActivityDisplayEn: string;
  activityYear: number | null;
  activityYearLabelAr: string;
  activityYearLabelEn: string;
  activityYearSource: string | null;
  standardizedTestType: string | null;
  standardizedScoreComparable: number | null;
  standardizedScoreLabel: string;
  levelLabelAr: string;
  levelLabelEn: string;
  participationLabelAr: string;
  participationLabelEn: string;
  resultLabelAr: string;
  resultLabelEn: string;
  /** Structured outcome key for analytics bucketing (medal:gold, rank:first, …) */
  outcomeKey: string;
  medalType: string | null;
  rank: string | null;
  year: number | null;
  dateIso: string | null;
  dateLabelAr: string;
  status: string;
  certificateIssued: boolean;
  description: string;
};

const parseDate = (v: unknown): Date | null => {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

export const buildUnifiedAdminAchievementReports = async (
  filters: AdminReportFilters
): Promise<{
  rows: AdminReportRow[];
  stats: Record<string, unknown>;
  admin: Record<string, unknown>;
  filters: AdminReportFilters;
}> => {
  await connectDB();

  const categories = normalizeReportCategories(filters);
  const levels = normalizeReportLevels(filters);
  const resultTokens = normalizeReportResultTokens(filters);

  const query: Record<string, unknown> = {};
  const rootAnd: Record<string, unknown>[] = [];

  if (levels.length === 1) {
    query.achievementLevel = levels[0];
  } else if (levels.length > 1) {
    query.achievementLevel = { $in: levels };
  }

  const multi = resolveReportMultiFilters(filters);
  const statusMongo = buildMultiFilterMongoQuery("status", multi.statuses);
  if (statusMongo) Object.assign(query, statusMongo);
  // achievementName filter applied post-normalization (canonical activity key)

  const categoryFilter = buildReportCategoriesMongoFilter(categories);
  if (categoryFilter) rootAnd.push(categoryFilter);

  const resultConds = resultTokens
    .map((t) => resultTokenToMongoCondition(t))
    .filter((c): c is Record<string, unknown> => c != null);
  if (resultConds.length === 1) {
    rootAnd.push(resultConds[0]);
  } else if (resultConds.length > 1) {
    rootAnd.push({ $or: resultConds });
  }

  if (rootAnd.length === 1) {
    Object.assign(query, rootAnd[0]);
  } else if (rootAnd.length > 1) {
    query.$and = rootAnd;
  }

  const from = parseDate(filters.fromDate);
  const to = parseDate(filters.toDate);
  if (from || to) {
    query.date = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const achievements = (await Achievement.find(query)
    .select(
      "userId studentSourceType studentSnapshot studentProfileKey achievementType achievementCategory achievementName customAchievementName nameAr nameEn title achievementLevel participationType resultType resultValue medalType rank nominationText specialAwardText score qudratScore giftedDiscoveryScore standardizedTest activityYear competitionEdition achievementYear date createdAt description status certificateIssued certificateIssuedAt verificationStatus pendingReReview attachments evidenceUrl"
    )
    .sort({ createdAt: -1 })
    .lean()) as unknown as Record<string, unknown>[];

  const userIds = [
    ...new Set(achievements.map((a) => String(a.userId || "")).filter(Boolean)),
  ].map((x) => new mongoose.Types.ObjectId(x));
  const users =
    userIds.length > 0
      ? ((await User.find({ _id: { $in: userIds } })
          .select("fullName fullNameAr fullNameEn gender grade studentId isMawhibaStudent")
          .lean()) as unknown as Record<string, unknown>[])
      : [];
  const userMap = new Map<string, Record<string, unknown>>();
  for (const u of users) userMap.set(String(u._id), u);

  const resolveStudent = (
    a: Record<string, unknown>,
    u: Record<string, unknown>
  ): {
    studentId: string;
    studentName: string;
    gender: string;
    grade: string;
    isMawhibaStudent: boolean;
  } => {
    const uid = String(a.userId || "");
    if (uid && u && Object.keys(u).length > 0) {
      return {
        studentId: String(u.studentId || ""),
        studentName:
          String(u.fullNameAr || "").trim() ||
          String(u.fullNameEn || "").trim() ||
          String(u.fullName || "").trim() ||
          "—",
        gender: String(u.gender || "").trim().toLowerCase(),
        grade: String(u.grade || "").trim(),
        isMawhibaStudent: u.isMawhibaStudent === true,
      };
    }
    const snap = (a.studentSnapshot || {}) as Record<string, unknown>;
    return {
      studentId: safeStr(a.studentProfileKey) || "—",
      studentName:
        String(snap.fullNameAr || "").trim() ||
        String(snap.fullNameEn || "").trim() ||
        "—",
      gender: String(snap.gender || "male").trim().toLowerCase() === "female" ? "female" : "male",
      grade: String(snap.grade || "").trim(),
      isMawhibaStudent: snap.isMawhibaStudent === true,
    };
  };

  const rows: AdminReportRow[] = [];
  for (const a of achievements) {
    const uid = String(a.userId || "");
    const u = userMap.get(uid) || {};
    const rs = resolveStudent(a, u);
    const gender = rs.gender;
    const grade = rs.grade;
    const isMawhibaStudent = rs.isMawhibaStudent;
    const stage = getStageByGrade(grade);
    const refDate = (a.date as Date) || (a.createdAt as Date) || null;
    const canonical = resolveCanonicalActivity(a);
    const eventLabelAr = canonical.displayNameAr;
    const eventLabelEn = canonical.displayNameEn;
    const categoryKey = resolveStoredAchievementReportCategory({
      achievementType: String(a.achievementType || ""),
      achievementCategory: String(a.achievementCategory || ""),
      achievementName: String(a.achievementName || ""),
      description: String(a.description || ""),
    });

    const stdInput = {
      achievementType: String(a.achievementType || ""),
      achievementCategory: String(a.achievementCategory || ""),
      achievementName: String(a.achievementName || ""),
      customAchievementName: String(a.customAchievementName || ""),
      title: String(a.title || a.nameAr || a.nameEn || ""),
      resultType: String(a.resultType || ""),
      resultValue: String(a.resultValue || ""),
      medalType: String(a.medalType || ""),
      rank: String(a.rank || ""),
      nominationText: String(a.nominationText || ""),
      specialAwardText: String(a.specialAwardText || ""),
      description: String(a.description || ""),
      qudratScore: String(a.qudratScore || ""),
      giftedDiscoveryScore:
        typeof a.giftedDiscoveryScore === "number" ? a.giftedDiscoveryScore : undefined,
      standardizedTest: a.standardizedTest as Record<string, unknown> | undefined,
    };
    const activityYearResolved = extractActivityYearFromAchievement(a, {
      academicYear: filters.academicYear,
    });
    const activityYear = activityYearResolved.year;
    const comparableScore = resolveStandardizedComparableScore(stdInput);
    const outcome = resolveAchievementOutcome(
      stdInput,
      stdInput.resultType === "score" && stdInput.resultValue ? stdInput.resultValue : undefined
    );

    const row: AdminReportRow = {
      id: String(a._id),
      studentId: rs.studentId,
      studentName: rs.studentName,
      gender,
      grade,
      isMawhibaStudent,
      stage,
      stageLabelAr: reportStageLabel(stage, true),
      stageLabelEn: reportStageLabel(stage, false),
      categoryLabelAr: labelAchievementCategory(categoryKey || undefined, "ar"),
      categoryLabelEn: labelAchievementCategory(categoryKey || undefined, "en"),
      eventLabelAr,
      eventLabelEn,
      analyticsActivityKey: canonical.canonicalKey,
      analyticsActivityDisplayAr: canonical.displayNameAr,
      analyticsActivityDisplayEn: canonical.displayNameEn,
      activityYear,
      activityYearLabelAr: activityYearResolved.activityYearLabelAr,
      activityYearLabelEn: activityYearResolved.activityYearLabelEn,
      activityYearSource: activityYearResolved.source,
      standardizedTestType: resolveStandardizedTestType(stdInput) || null,
      standardizedScoreComparable: comparableScore,
      standardizedScoreLabel:
        resolveAchievementResultDisplay(stdInput, "ar").split(" ").slice(1).join(" ") || "—",
      levelLabelAr: getAchievementLevelLabel(a.achievementLevel, "ar"),
      levelLabelEn: getAchievementLevelLabel(a.achievementLevel, "en"),
      participationLabelAr: getParticipationTypeLabel(a.participationType, "ar"),
      participationLabelEn: getParticipationTypeLabel(a.participationType, "en"),
      resultLabelAr: resolveAchievementResultDisplay(stdInput, "ar"),
      resultLabelEn: resolveAchievementResultDisplay(stdInput, "en"),
      outcomeKey: outcome.outcomeKey,
      medalType: outcome.medalType,
      rank: outcome.rank,
      year: typeof a.achievementYear === "number" ? a.achievementYear : null,
      dateIso: refDate instanceof Date && !Number.isNaN(refDate.getTime()) ? refDate.toISOString() : null,
      dateLabelAr:
        refDate instanceof Date && !Number.isNaN(refDate.getTime())
          ? refDate.toLocaleDateString("ar-SA")
          : "—",
      status: String(a.status || ""),
      certificateIssued: a.certificateIssued === true,
      description: String(a.description || "").trim() || "—",
    };
    rows.push(row);
  }

  let filtered = rows.filter((r) => {
    if (multi.genders.length > 0 && !multi.genders.includes(r.gender)) return false;
    if (multi.mawhibaValues.length > 0) {
      const wantYes = multi.mawhibaValues.includes("yes");
      const wantNo = multi.mawhibaValues.includes("no");
      if (wantYes !== wantNo) {
        if (wantYes && !r.isMawhibaStudent) return false;
        if (wantNo && r.isMawhibaStudent) return false;
      }
    }
    if (multi.stages.length > 0 && !multi.stages.includes(r.stage)) return false;
    if (multi.grades.length > 0 && !multi.grades.includes(r.grade)) return false;
    if (multi.certificateStatuses.length > 0) {
      const wantIssued = multi.certificateStatuses.includes("issued");
      const wantNot = multi.certificateStatuses.includes("not_issued");
      if (wantIssued !== wantNot) {
        if (wantIssued && !r.certificateIssued) return false;
        if (wantNot && r.certificateIssued) return false;
      }
    }
    if (multi.achievementNames.length > 0) {
      const rowKey = r.analyticsActivityKey;
      const matched = multi.achievementNames.some((fk) => {
        if (rowKey === fk) return true;
        return rowKey === resolveCanonicalActivity(fk).canonicalKey;
      });
      if (!matched) return false;
    }
    if (multi.standardizedTestTypes.length > 0) {
      if (!r.standardizedTestType || !multi.standardizedTestTypes.includes(r.standardizedTestType)) {
        return false;
      }
    }
    if (filters.scoreMin != null || filters.scoreMax != null) {
      const sc = r.standardizedScoreComparable;
      if (sc == null) return false;
      if (filters.scoreMin != null && sc < filters.scoreMin) return false;
      if (filters.scoreMax != null && sc > filters.scoreMax) return false;
    }
    if (multi.activityYears.length > 0) {
      if (r.activityYear == null || !multi.activityYears.includes(r.activityYear)) return false;
    }
    return true;
  });

  if (filters.uniqueParticipantsOnly) {
    const seen = new Set<string>();
    filtered = filtered.filter((r) => {
      const k = `${r.studentId}\u001f${r.analyticsActivityKey}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const byMawhiba = {
    mawhiba: filtered.filter((r) => r.isMawhibaStudent).length,
    nonMawhiba: filtered.filter((r) => !r.isMawhibaStudent).length,
  };
  const studentsMawhiba = new Set(
    filtered.filter((r) => r.isMawhibaStudent).map((r) => r.studentId)
  ).size;
  const studentsNonMawhiba = new Set(
    filtered.filter((r) => !r.isMawhibaStudent).map((r) => r.studentId)
  ).size;

  const byGender = {
    male: filtered.filter((r) => r.gender === "male").length,
    female: filtered.filter((r) => r.gender === "female").length,
  };
  const studentsMale = new Set(filtered.filter((r) => r.gender === "male").map((r) => r.studentId)).size;
  const studentsFemale = new Set(filtered.filter((r) => r.gender === "female").map((r) => r.studentId)).size;
  const certMale = filtered.filter((r) => r.gender === "male" && r.certificateIssued).length;
  const certFemale = filtered.filter((r) => r.gender === "female" && r.certificateIssued).length;

  const byStage = ["primary", "middle", "secondary"].map((s) => {
    const rowsS = filtered.filter((r) => r.stage === s);
    return {
      stage: s,
      labelAr: reportStageLabel(s as ReportStage, true),
      labelEn: reportStageLabel(s as ReportStage, false),
      achievements: rowsS.length,
      certificates: rowsS.filter((r) => r.certificateIssued).length,
    };
  });

  const byCategory = countBy(
    filtered.map((r) => ({ key: r.categoryLabelAr || "غير محدد" })) as unknown as Record<string, unknown>[],
    "key"
  );
  const byEventStudents = (() => {
    const m = new Map<
      string,
      { labelAr: string; labelEn: string; s: Set<string>; rows: number; cat: string; canonicalKey: string }
    >();
    for (const r of filtered) {
      const key = r.analyticsActivityKey || `${r.eventLabelAr}||${r.eventLabelEn}`;
      const hit = m.get(key) || {
        labelAr: r.analyticsActivityDisplayAr || r.eventLabelAr,
        labelEn: r.analyticsActivityDisplayEn || r.eventLabelEn,
        s: new Set<string>(),
        rows: 0,
        cat: r.categoryLabelAr,
        canonicalKey: r.analyticsActivityKey,
      };
      hit.rows += 1;
      hit.s.add(r.studentId || r.id);
      m.set(key, hit);
    }
    return [...m.values()]
      .map((x) => ({
        labelAr: x.labelAr,
        labelEn: x.labelEn,
        canonicalKey: x.canonicalKey,
        studentCount: x.s.size,
        rowsCount: x.rows,
        categoryAr: x.cat,
      }))
      .sort((a, b) => b.studentCount - a.studentCount);
  })();

  const byResult = countBy(
    filtered.map((r) => ({ key: r.resultLabelAr || "بدون نتيجة" })) as unknown as Record<string, unknown>[],
    "key"
  );
  const byLevel = countBy(
    filtered.map((r) => ({ key: r.levelLabelAr || "غير محدد" })) as unknown as Record<string, unknown>[],
    "key"
  );

  const byActivityYear = (() => {
    const m = new Map<
      number,
      {
        year: number;
        rows: number;
        students: Set<string>;
        medals: number;
        certificates: number;
        stdScores: number[];
      }
    >();
    for (const r of filtered) {
      if (r.activityYear == null) continue;
      const hit =
        m.get(r.activityYear) ??
        ({
          year: r.activityYear,
          rows: 0,
          students: new Set<string>(),
          medals: 0,
          certificates: 0,
          stdScores: [],
        } as const);
      const bucket = {
        year: r.activityYear,
        rows: hit.rows + 1,
        students: new Set(hit.students),
        medals: hit.medals,
        certificates: hit.certificates,
        stdScores: [...hit.stdScores],
      };
      bucket.students.add(r.studentId || r.id);
      if (String(r.resultLabelAr || "").includes("ميدالية")) bucket.medals += 1;
      if (r.certificateIssued) bucket.certificates += 1;
      if (r.standardizedScoreComparable != null) bucket.stdScores.push(r.standardizedScoreComparable);
      m.set(r.activityYear, bucket);
    }
    return [...m.values()]
      .map((x) => ({
        year: x.year,
        labelAr: buildActivityYearLabel(x.year, "ar"),
        labelEn: buildActivityYearLabel(x.year, "en"),
        rowsCount: x.rows,
        studentCount: x.students.size,
        medalCount: x.medals,
        certificateCount: x.certificates,
        avgStdScore:
          x.stdScores.length > 0
            ? Math.round((x.stdScores.reduce((a, b) => a + b, 0) / x.stdScores.length) * 10) / 10
            : null,
      }))
      .sort((a, b) => b.year - a.year);
  })();

  const yearOverYearByActivity = (() => {
    const m = new Map<string, Map<number, { rows: number; students: Set<string> }>>();
    for (const r of filtered) {
      if (r.activityYear == null) continue;
      const key = r.analyticsActivityKey || r.eventLabelAr;
      const actMap = m.get(key) ?? new Map();
      const hit = actMap.get(r.activityYear) ?? { rows: 0, students: new Set<string>() };
      hit.rows += 1;
      hit.students.add(r.studentId || r.id);
      actMap.set(r.activityYear, hit);
      m.set(key, actMap);
    }
    return [...m.entries()]
      .map(([activityKey, yearMap]) => {
        const years = [...yearMap.entries()]
          .map(([year, v]) => ({
            year,
            rowsCount: v.rows,
            studentCount: v.students.size,
          }))
          .sort((a, b) => a.year - b.year);
        const first = years[0]?.rowsCount ?? 0;
        const last = years[years.length - 1]?.rowsCount ?? 0;
        const growthPct =
          first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : last > 0 ? 100 : 0;
        const sample = filtered.find((r) => (r.analyticsActivityKey || r.eventLabelAr) === activityKey);
        return {
          activityKey,
          labelAr: sample?.analyticsActivityDisplayAr || sample?.eventLabelAr || activityKey,
          labelEn: sample?.analyticsActivityDisplayEn || sample?.eventLabelEn || activityKey,
          years,
          growthPct,
        };
      })
      .filter((x) => x.years.length >= 1)
      .sort((a, b) => {
        const lb = b.years[b.years.length - 1]?.rowsCount ?? 0;
        const la = a.years[a.years.length - 1]?.rowsCount ?? 0;
        return lb - la;
      })
      .slice(0, 20);
  })();

  const standardizedTestStats = (() => {
    const scored = filtered.filter((r) => r.standardizedScoreComparable != null);
    if (scored.length === 0) return null;
    const byType = new Map<
      string,
      { scores: number[]; students: Set<string>; count: number }
    >();
    for (const r of scored) {
      const t = r.standardizedTestType || "other";
      const hit = byType.get(t) || { scores: [], students: new Set<string>(), count: 0 };
      hit.scores.push(r.standardizedScoreComparable!);
      hit.students.add(r.studentId);
      hit.count += 1;
      byType.set(t, hit);
    }
    return [...byType.entries()].map(([testType, v]) => {
      const sorted = [...v.scores].sort((a, b) => b - a);
      const sum = sorted.reduce((a, b) => a + b, 0);
      return {
        testType,
        count: v.count,
        studentCount: v.students.size,
        average: Math.round((sum / sorted.length) * 10) / 10,
        max: sorted[0],
        min: sorted[sorted.length - 1],
        above95: sorted.filter((s) => s >= 95).length,
        above1400: testType === "sat" ? sorted.filter((s) => s >= 1400).length : undefined,
        above7: testType === "ielts" ? sorted.filter((s) => s >= 7).length : undefined,
      };
    });
  })();

  const topStudents = (() => {
    const m = new Map<
      string,
      {
        studentName: string;
        grade: string;
        stageLabelAr: string;
        stageLabelEn: string;
        total: number;
        approved: number;
        certificates: number;
        topLevel: string;
      }
    >();
    for (const r of filtered) {
      const key = r.studentId || r.id;
      const hit = m.get(key) || {
        studentName: r.studentName,
        grade: r.grade || "—",
        stageLabelAr: r.stageLabelAr,
        stageLabelEn: r.stageLabelEn,
        total: 0,
        approved: 0,
        certificates: 0,
        topLevel: "—",
      };
      hit.total += 1;
      if (r.status === "approved") hit.approved += 1;
      if (r.certificateIssued) hit.certificates += 1;
      if (hit.topLevel === "—") hit.topLevel = r.levelLabelAr;
      m.set(key, hit);
    }
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  })();

  const missingData = {
    noDescription: filtered.filter((r) => !r.description || r.description === "—").length,
    noResult: filtered.filter((r) => !r.resultLabelAr || r.resultLabelAr === "—").length,
    noLevel: filtered.filter((r) => !r.levelLabelAr || r.levelLabelAr === "غير محدد").length,
    noCategory: filtered.filter((r) => !r.categoryLabelAr || r.categoryLabelAr === "—").length,
    noCertificate: filtered.filter((r) => !r.certificateIssued).length,
  };

  const priority = {
    pending: filtered.filter((r) => r.status === "pending" || r.status === "pending_review").length,
    resubmitted: filtered.filter((r) => r.status === "needs_revision").length,
    aiFlagged: await Achievement.countDocuments(buildAdminAchievementListFilter("ai_flagged")),
    readyToIssue: filtered.filter((r) => r.status === "approved" && !r.certificateIssued).length,
  };

  const statusCounts = {
    total: filtered.length,
    approved: filtered.filter((r) => r.status === "approved").length,
    pending: filtered.filter((r) => r.status === "pending" || r.status === "pending_review").length,
    needsRevision: filtered.filter((r) => r.status === "needs_revision").length,
    rejected: filtered.filter((r) => r.status === "rejected").length,
    issued: filtered.filter((r) => r.certificateIssued).length,
    withoutCertificate: filtered.filter((r) => !r.certificateIssued).length,
  };

  const filtersOut: AdminReportFilters = {
    ...filters,
    categories,
    levels,
    resultTokens,
  };

  return {
    rows: filtered,
    stats: {
      byMawhiba: {
        achievementsMawhiba: byMawhiba.mawhiba,
        achievementsNonMawhiba: byMawhiba.nonMawhiba,
        participantsMawhiba: studentsMawhiba,
        participantsNonMawhiba: studentsNonMawhiba,
      },
      byGender: {
        achievementsBoys: byGender.male,
        achievementsGirls: byGender.female,
        participantsBoys: studentsMale,
        participantsGirls: studentsFemale,
        certificatesBoys: certMale,
        certificatesGirls: certFemale,
      },
      byStage,
      byCategory,
      byEventStudents,
      byResult,
      byLevel,
      byActivityYear,
      yearOverYearByActivity,
      standardizedTestStats,
    },
    admin: {
      topStudents,
      topEvents: byEventStudents.slice(0, 10),
      statusCounts,
      missingData,
      priority,
    },
    filters: filtersOut,
  };
};

export type CanonicalActivityOption = {
  canonicalKey: string;
  displayNameAr: string;
  displayNameEn: string;
  category: ActivityRegistryCategory;
  groupLabelAr: string;
  groupLabelEn: string;
  rowCount: number;
  studentCount: number;
};

/** Canonical deduplicated activity list for report filter combobox. */
export const buildCanonicalActivityOptions = async (
  filters: AdminReportFilters & { search?: string; limit?: number }
): Promise<CanonicalActivityOption[]> => {
  const {
    search,
    limit = 500,
    achievementName: _skip,
    achievementNames: _skipNames,
    filterActivityYear: _skipYear,
    activityYears: _skipYears,
    uniqueParticipantsOnly: _u,
    ...rest
  } = filters;
  void _skip;
  void _skipNames;
  void _skipYear;
  void _skipYears;
  void _u;
  const payload = await buildUnifiedAdminAchievementReports({
    ...rest,
    achievementName: "all",
    achievementNames: [],
    uniqueParticipantsOnly: false,
  });

  const searchNorm = normalizeAchievementActivityName(search || "");
  const m = new Map<
    string,
    { option: CanonicalActivityOption; students: Set<string>; rows: number }
  >();

  for (const r of payload.rows) {
    const key = r.analyticsActivityKey;
    if (!key) continue;
    const canonical = resolveCanonicalActivity(key);
    const grp =
      ACTIVITY_REGISTRY_GROUP_LABELS[canonical.category] ??
      ACTIVITY_REGISTRY_GROUP_LABELS.other;
    const hit =
      m.get(key) ??
      ({
        option: {
          canonicalKey: key,
          displayNameAr: r.analyticsActivityDisplayAr || canonical.displayNameAr,
          displayNameEn: r.analyticsActivityDisplayEn || canonical.displayNameEn,
          category: canonical.category,
          groupLabelAr: grp.ar,
          groupLabelEn: grp.en,
          rowCount: 0,
          studentCount: 0,
        },
        students: new Set<string>(),
        rows: 0,
      } as const);
    const bucket = {
      option: hit.option,
      students: new Set(hit.students),
      rows: hit.rows + 1,
    };
    bucket.students.add(r.studentId || r.id);
    bucket.option = {
      ...hit.option,
      rowCount: bucket.rows,
      studentCount: bucket.students.size,
    };
    m.set(key, bucket);
  }

  let options = [...m.values()].map((x) => ({
    ...x.option,
    rowCount: x.rows,
    studentCount: x.students.size,
  }));

  if (searchNorm) {
    options = options.filter((o) => {
      const hay = [o.canonicalKey, o.displayNameAr, o.displayNameEn, o.groupLabelAr, o.groupLabelEn]
        .map((s) => normalizeAchievementActivityName(s))
        .join(" ");
      return (
        hay.includes(searchNorm) ||
        o.canonicalKey.includes(searchNorm.replace(/\s+/g, "_"))
      );
    });
  }

  options.sort((a, b) => {
    const ga = a.groupLabelAr.localeCompare(b.groupLabelAr, "ar");
    if (ga !== 0) return ga;
    return b.rowCount - a.rowCount || a.displayNameAr.localeCompare(b.displayNameAr, "ar");
  });

  return options.slice(0, limit);
};

export type ActivityYearOption = {
  year: number;
  labelAr: string;
  labelEn: string;
  rowCount: number;
  studentCount: number;
};

/** Deduplicated activity years for report filter combobox. */
export const buildCanonicalActivityYearOptions = async (
  filters: AdminReportFilters & { search?: string; limit?: number }
): Promise<ActivityYearOption[]> => {
  const {
    search,
    limit = 50,
    filterActivityYear: _skipYear,
    activityYears: _skipYears,
    achievementName: _skipAct,
    achievementNames: _skipNames,
    uniqueParticipantsOnly: _u,
    ...rest
  } = filters;
  void _skipYear;
  void _skipYears;
  void _skipAct;
  void _skipNames;
  void _u;

  const payload = await buildUnifiedAdminAchievementReports({
    ...rest,
    filterActivityYear: "all",
    activityYears: [],
    achievementName: "all",
    achievementNames: [],
    uniqueParticipantsOnly: false,
  });

  const searchNorm = String(search || "").trim();
  const m = new Map<number, { rows: number; students: Set<string> }>();

  for (const r of payload.rows) {
    if (r.activityYear == null) continue;
    const hit = m.get(r.activityYear) ?? { rows: 0, students: new Set<string>() };
    hit.rows += 1;
    hit.students.add(r.studentId || r.id);
    m.set(r.activityYear, hit);
  }

  let options: ActivityYearOption[] = [...m.entries()].map(([year, v]) => ({
    year,
    labelAr: buildActivityYearLabel(year, "ar"),
    labelEn: buildActivityYearLabel(year, "en"),
    rowCount: v.rows,
    studentCount: v.students.size,
  }));

  if (searchNorm) {
    options = options.filter((o) => String(o.year).includes(searchNorm) || o.labelAr.includes(searchNorm));
  }

  options.sort((a, b) => b.year - a.year);
  return options.slice(0, limit);
};
