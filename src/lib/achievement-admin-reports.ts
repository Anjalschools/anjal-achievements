/**
 * Aggregated achievement statistics for admin dashboards and AI-assisted reports.
 */

import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { DUPLICATE_FLAG } from "@/lib/achievement-review-rules";

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
