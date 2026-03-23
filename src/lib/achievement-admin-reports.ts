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
  formatLocalizedResultLine,
  getAchievementDisplayName,
  getAchievementLevelLabel,
  labelAchievementCategory,
  safeTrim as displaySafeTrim,
} from "@/lib/achievementDisplay";
import { getStageByGrade, reportStageLabel, type ReportStage } from "@/lib/report-stage-mapping";
import {
  REPORT_CATEGORY_VALUES,
  REPORT_LEVEL_VALUES,
  REPORT_RESULT_TOKEN_VALUES,
  resultTokenToMongoCondition,
} from "@/lib/report-filter-options";

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
    topAchievementNames: topN(nameCounts, 12),
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
    .select("fullName fullNameAr fullNameEn email grade section studentId")
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
    .map((r) => ({
      title: safeStr(r.achievementName),
      score: r.score,
      year: r.achievementYear,
    }));

  return {
    scope: "student",
    student: {
      id: userId,
      fullName: safeStr(u.fullName || u.fullNameAr),
      grade: safeStr(u.grade),
      section: safeStr(u.section),
      studentId: safeStr(u.studentId),
    },
    totalAchievements: total,
    byType: countBy(list, "achievementType"),
    byField: countBy(list, "inferredField"),
    byLevel: countBy(list, "achievementLevel"),
    byStatus: countBy(list, "status"),
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

  return {
    scope: "field",
    field: f,
    totalAchievements: list.length,
    distinctStudents: studentIds.size,
    byType: countBy(list, "achievementType"),
    byLevel: countBy(list, "achievementLevel"),
    byStatus: countBy(list, "status"),
    byResultType: byResult,
    topAchievementNames: topN(nameCounts, 15),
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

  return {
    scope: "competition",
    competitionKey: key,
    totalRows: list.length,
    distinctStudents: studentIds.size,
    byField: countBy(list, "inferredField"),
    byLevel: countBy(list, "achievementLevel"),
    byStatus: countBy(list, "status"),
    byResultType: countBy(list, "resultType"),
    byMedal: countBy(list, "medalType"),
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
  stage?: string;
  grade?: string;
  /** @deprecated prefer `categories` */
  category?: string;
  /** Empty array = الكل (no filter). */
  categories?: string[];
  achievementName?: string;
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
  fromDate?: string;
  toDate?: string;
};

const ALLOW_CATEGORY = new Set<string>([...REPORT_CATEGORY_VALUES]);
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
  stage: ReportStage;
  stageLabelAr: string;
  stageLabelEn: string;
  categoryLabelAr: string;
  categoryLabelEn: string;
  eventLabelAr: string;
  eventLabelEn: string;
  levelLabelAr: string;
  levelLabelEn: string;
  participationLabelAr: string;
  participationLabelEn: string;
  resultLabelAr: string;
  resultLabelEn: string;
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

const participationLabel = (key: unknown, isAr: boolean): string => {
  const k = String(key || "").trim().toLowerCase();
  if (k === "individual") return isAr ? "فردي" : "Individual";
  if (k === "team") return isAr ? "جماعي" : "Team";
  return isAr ? "غير محدد" : "Not specified";
};

const statusLabel = (key: unknown, isAr: boolean): string => {
  const k = String(key || "").trim();
  const m: Record<string, [string, string]> = {
    pending: ["قيد المراجعة", "Pending"],
    pending_review: ["قيد المراجعة", "Pending review"],
    needs_revision: ["يحتاج تعديل", "Needs revision"],
    approved: ["معتمد", "Approved"],
    rejected: ["مرفوض", "Rejected"],
  };
  const hit = m[k];
  if (hit) return isAr ? hit[0] : hit[1];
  return isAr ? "غير محدد" : "Unknown";
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

  if (filters.status && filters.status !== "all") query.status = filters.status;
  if (filters.achievementName && filters.achievementName !== "all") {
    const esc = String(filters.achievementName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.achievementName = new RegExp(`^${esc}$`, "i");
  }

  if (categories.length > 0) {
    rootAnd.push({
      $or: [
        { achievementCategory: { $in: categories } },
        { achievementType: { $in: categories } },
      ],
    });
  }

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
      "userId achievementType achievementCategory achievementName customAchievementName nameAr nameEn title achievementLevel participationType resultType resultValue medalType rank score achievementYear date createdAt description status certificateIssued certificateIssuedAt verificationStatus pendingReReview attachments evidenceUrl"
    )
    .sort({ createdAt: -1 })
    .lean()) as unknown as Record<string, unknown>[];

  const userIds = [...new Set(achievements.map((a) => String(a.userId || "")).filter(Boolean))].map(
    (x) => new mongoose.Types.ObjectId(x)
  );
  const users = (await User.find({ _id: { $in: userIds } })
    .select("fullName fullNameAr fullNameEn gender grade studentId")
    .lean()) as unknown as Record<string, unknown>[];
  const userMap = new Map<string, Record<string, unknown>>();
  for (const u of users) userMap.set(String(u._id), u);

  const rows: AdminReportRow[] = [];
  for (const a of achievements) {
    const uid = String(a.userId || "");
    const u = userMap.get(uid) || {};
    const gender = String(u.gender || "").trim().toLowerCase();
    const grade = String(u.grade || "").trim();
    const stage = getStageByGrade(grade);
    const refDate = (a.date as Date) || (a.createdAt as Date) || null;
    const eventLabelAr = getAchievementDisplayName(a, "ar");
    const eventLabelEn = getAchievementDisplayName(a, "en");
    const categoryKey = displaySafeTrim(a.achievementCategory || a.achievementType);

    const row: AdminReportRow = {
      id: String(a._id),
      studentId: String(u.studentId || ""),
      studentName:
        String(u.fullNameAr || "").trim() ||
        String(u.fullNameEn || "").trim() ||
        String(u.fullName || "").trim() ||
        "—",
      gender,
      grade,
      stage,
      stageLabelAr: reportStageLabel(stage, true),
      stageLabelEn: reportStageLabel(stage, false),
      categoryLabelAr: labelAchievementCategory(categoryKey || undefined, "ar"),
      categoryLabelEn: labelAchievementCategory(categoryKey || undefined, "en"),
      eventLabelAr,
      eventLabelEn,
      levelLabelAr: getAchievementLevelLabel(a.achievementLevel, "ar"),
      levelLabelEn: getAchievementLevelLabel(a.achievementLevel, "en"),
      participationLabelAr: participationLabel(a.participationType, true),
      participationLabelEn: participationLabel(a.participationType, false),
      resultLabelAr: formatLocalizedResultLine(
        String(a.resultType || ""),
        String(a.medalType || ""),
        String(a.rank || ""),
        "ar",
        typeof a.score === "number" ? a.score : undefined
      ),
      resultLabelEn: formatLocalizedResultLine(
        String(a.resultType || ""),
        String(a.medalType || ""),
        String(a.rank || ""),
        "en",
        typeof a.score === "number" ? a.score : undefined
      ),
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

  const filtered = rows.filter((r) => {
    if (filters.gender && filters.gender !== "all" && r.gender !== filters.gender) return false;
    if (filters.stage && filters.stage !== "all" && r.stage !== filters.stage) return false;
    if (filters.grade && filters.grade !== "all" && r.grade !== filters.grade) return false;
    if (filters.certificateStatus && filters.certificateStatus !== "all") {
      if (filters.certificateStatus === "issued" && !r.certificateIssued) return false;
      if (filters.certificateStatus === "not_issued" && r.certificateIssued) return false;
    }
    return true;
  });

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
    const m = new Map<string, { labelAr: string; labelEn: string; s: Set<string>; rows: number; cat: string }>();
    for (const r of filtered) {
      const key = `${r.eventLabelAr}||${r.eventLabelEn}`;
      const hit = m.get(key) || {
        labelAr: r.eventLabelAr,
        labelEn: r.eventLabelEn,
        s: new Set<string>(),
        rows: 0,
        cat: r.categoryLabelAr,
      };
      hit.rows += 1;
      hit.s.add(r.studentId || r.id);
      m.set(key, hit);
    }
    return [...m.values()]
      .map((x) => ({
        labelAr: x.labelAr,
        labelEn: x.labelEn,
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

  const topStudents = (() => {
    const m = new Map<
      string,
      {
        studentName: string;
        grade: string;
        stageLabelAr: string;
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
