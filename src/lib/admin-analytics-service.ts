import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { getStageByGrade } from "@/lib/report-stage-mapping";
import { DUPLICATE_FLAG } from "@/lib/achievement-review-rules";
import { getGradeLabel } from "@/constants/grades";
import { getDbAchievementTypeLabel } from "@/lib/achievement-labels";
import { getAchievementLevelLabel, labelInferredField } from "@/lib/achievementDisplay";
import {
  labelGenderKey,
  labelStageKey,
  labelStatusBucket,
  labelTrackKey,
} from "@/lib/admin-advanced-analytics-labels";
import { buildAdvancedAnalyticsRecommendations } from "@/lib/admin-advanced-analytics-recommendations";
import type { AdminInsightItem, AdvancedLabeledRow } from "@/lib/admin-advanced-analytics-types";

export type { AdminInsightItem, AdvancedLabeledRow } from "@/lib/admin-advanced-analytics-types";

const safeStr = (v: unknown) => String(v ?? "").trim();

const approvedLike = (r: Record<string, unknown>) => {
  const s = safeStr(r.status);
  return s === "approved" || r.approved === true;
};

const isFeaturedRow = (r: Record<string, unknown>) =>
  r.isFeatured === true || r.featured === true;

const statusBucket = (r: Record<string, unknown>): string => {
  const s = safeStr(r.status);
  if (s === "rejected") return "rejected";
  if (r.pendingReReview === true && approvedLike(r)) return "pending_re_review";
  if (approvedLike(r)) {
    if (isFeaturedRow(r)) return "featured";
    return "approved";
  }
  if (s === "needs_revision") return "needs_revision";
  if (s === "pending" || s === "pending_review") return "pending";
  return "other";
};

const rowsFromCounts = (
  counts: Record<string, number>,
  total: number,
  resolve: (key: string) => { ar: string; en: string }
): AdvancedLabeledRow[] => {
  const entries = Object.entries(counts).filter(([, c]) => c > 0);
  entries.sort((a, b) => b[1] - a[1]);
  const denom = total > 0 ? total : entries.reduce((s, [, c]) => s + c, 0);
  return entries.map(([k, c]) => {
    const { ar, en } = resolve(k);
    return {
      key: k,
      labelAr: ar,
      labelEn: en,
      count: c,
      pct: denom > 0 ? Math.round((c / denom) * 1000) / 10 : 0,
    };
  });
};

const MONTH_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const MONTH_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const buildAdminAnalyticsOverview = async (): Promise<Record<string, unknown>> => {
  await connectDB();
  const now = new Date();
  const y = now.getFullYear();

  const base = await Achievement.find({})
    .select(
      "userId studentSourceType studentSnapshot status approved isFeatured featured pendingReReview gender achievementYear achievementLevel resultType participationType achievementType inferredField createdAt date reviewedAt adminApprovedAt"
    )
    .lean();

  const rows = base as unknown as Record<string, unknown>[];

  const inYear = (r: Record<string, unknown>) => Number(r.achievementYear) === y;

  const yearRows = rows.filter(inYear);
  const approvedRows = yearRows.filter(approvedLike);
  const featuredRows = yearRows.filter(isFeaturedRow);

  const genderCount: Record<string, number> = { male: 0, female: 0, unknown: 0 };
  const trackCount: Record<string, number> = {};
  const stageCount: Record<string, number> = {};
  const gradeCount: Record<string, number> = {};
  const typeCount: Record<string, number> = {};
  const levelCount: Record<string, number> = {};
  const fieldCount: Record<string, number> = {};

  const resolveGender = (r: Record<string, unknown>): "male" | "female" | "unknown" => {
    if (r.studentSourceType && r.studentSourceType !== "linked_user") {
      const g = safeStr((r.studentSnapshot as { gender?: string } | undefined)?.gender).toLowerCase();
      if (g === "female") return "female";
      if (g === "male") return "male";
      return "unknown";
    }
    return "unknown";
  };

  const userIds = [...new Set(rows.map((r) => String(r.userId || "")).filter(Boolean))];
  const users =
    userIds.length > 0
      ? await User.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select("gender grade section")
          .lean()
      : [];

  const userMap = new Map<string, { gender?: string; grade?: string; section?: string }>();
  for (const u of users) {
    userMap.set(String((u as { _id?: unknown })._id), u as { gender?: string; grade?: string; section?: string });
  }

  for (const r of approvedRows) {
    let g: "male" | "female" | "unknown" = "unknown";
    const st = safeStr(r.studentSourceType as string | undefined) || "linked_user";
    if (st !== "linked_user") {
      g = resolveGender(r);
    } else {
      const uid = String(r.userId || "");
      const u = uid ? userMap.get(uid) : undefined;
      if (u?.gender === "female") g = "female";
      else if (u?.gender === "male") g = "male";
    }
    genderCount[g]++;

    let grade = "";
    let section: string | undefined;
    if (r.studentSourceType && r.studentSourceType !== "linked_user") {
      grade = safeStr((r.studentSnapshot as { grade?: string } | undefined)?.grade);
      section = safeStr((r.studentSnapshot as { section?: string } | undefined)?.section);
    } else {
      const uid = String(r.userId || "");
      const u = uid ? userMap.get(uid) : undefined;
      grade = safeStr(u?.grade);
      section = safeStr(u?.section);
    }
    if (grade) gradeCount[grade] = (gradeCount[grade] || 0) + 1;
    const stageKey = getStageByGrade(grade || "g12");
    stageCount[stageKey] = (stageCount[stageKey] || 0) + 1;

    const tr = section === "international" ? "international" : section === "arabic" ? "arabic" : "unspecified";
    trackCount[tr] = (trackCount[tr] || 0) + 1;

    const tk = safeStr(r.achievementType) || "other";
    typeCount[tk] = (typeCount[tk] || 0) + 1;
    const lk = safeStr(r.achievementLevel) || "unknown";
    levelCount[lk] = (levelCount[lk] || 0) + 1;
    const fk = safeStr(r.inferredField) || "—";
    fieldCount[fk] = (fieldCount[fk] || 0) + 1;
  }

  const pending = rows.filter((r) => safeStr(r.status) === "pending" || safeStr(r.status) === "pending_review").length;
  const rejected = rows.filter((r) => safeStr(r.status) === "rejected").length;
  const needsRev = rows.filter((r) => safeStr(r.status) === "needs_revision").length;

  const approvedTotal = rows.filter(approvedLike).length;
  const reviewRatio = rows.length ? approvedTotal / rows.length : 0;

  const statusCounts: Record<string, number> = {};
  for (const r of rows) {
    const b = statusBucket(r);
    statusCounts[b] = (statusCounts[b] || 0) + 1;
  }

  const yearTrend = new Map<number, { total: number; approved: number }>();
  for (const r of rows) {
    const ay = Number(r.achievementYear);
    if (!Number.isFinite(ay)) continue;
    const cur = yearTrend.get(ay) || { total: 0, approved: 0 };
    cur.total++;
    if (approvedLike(r)) cur.approved++;
    yearTrend.set(ay, cur);
  }
  const trendsByAchievementYear = [...yearTrend.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => ({ year, total: v.total, approved: v.approved }));

  const monthCounts = new Array(12).fill(0);
  for (const r of yearRows) {
    const d = r.date;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== y) continue;
    monthCounts[d.getMonth()]++;
  }
  const byMonthInScopeYear = monthCounts.map((count, i) => ({
    month: i + 1,
    labelAr: MONTH_AR[i],
    labelEn: MONTH_EN[i],
    count,
  }));

  const approvedStudentIds = new Set<string>();
  for (const r of approvedRows) {
    const uid = String(r.userId || "");
    if (uid) approvedStudentIds.add(uid);
  }
  const activeStudentsWithApprovedInYear = approvedStudentIds.size;
  const avgApprovedPerActiveStudent =
    activeStudentsWithApprovedInYear > 0
      ? Math.round((approvedRows.length / activeStudentsWithApprovedInYear) * 100) / 100
      : null;

  const yearTotal = yearRows.length;
  const approvedShareOfYearPct =
    yearTotal > 0 ? Math.round((approvedRows.length / yearTotal) * 1000) / 10 : null;
  const featuredShareOfApprovedPct =
    approvedRows.length > 0
      ? Math.round((featuredRows.length / approvedRows.length) * 1000) / 10
      : null;

  const arTrack = trackCount.arabic || 0;
  const intlTrack = trackCount.international || 0;
  const unspecifiedTrack = trackCount.unspecified || 0;

  const genderTotal = Object.values(genderCount).reduce((s, n) => s + n, 0);
  const trackDenom = arTrack + intlTrack + unspecifiedTrack;
  const typeTotal = Object.values(typeCount).reduce((s, n) => s + n, 0);
  const levelTotal = Object.values(levelCount).reduce((s, n) => s + n, 0);
  const fieldTotal = Object.values(fieldCount).reduce((s, n) => s + n, 0);
  const gradeTotal = Object.values(gradeCount).reduce((s, n) => s + n, 0);
  const stageTotal = Object.values(stageCount).reduce((s, n) => s + n, 0);
  const statusTotal = Object.values(statusCounts).reduce((s, n) => s + n, 0);

  const narrativeInsights: string[] = [];
  if (yearTotal > 0 && approvedShareOfYearPct !== null) {
    narrativeInsights.push(
      `خلال نطاق العام الدراسي المسجّل (${y})، بلغت نسبة الإنجازات المعتمدة من إجمالي إنجازات نفس النطاق حوالي ${approvedShareOfYearPct}%، بينما تميّز ${featuredShareOfApprovedPct ?? 0}% من الإنجازات المعتمدة كإنجازات مميزة.`
    );
  }
  if (arTrack + intlTrack > 0) {
    if (arTrack > intlTrack * 1.25 && intlTrack > 0) {
      narrativeInsights.push(
        `تتجاوز كثافة الإنجازات المعتمدة في المسار العربي بوضوح المسار الدولي ضمن نطاق العام الحالي — مفيد لمراجعة التوازن بين المسارات والدعم الأكاديمي.`
      );
    } else if (intlTrack > arTrack * 1.25 && arTrack > 0) {
      narrativeInsights.push(
        `تتجاوز كثافة الإنجازات المعتمدة في المسار الدولي المسار العربي ضمن نطاق العام الحالي — راجع ما إذا كان ذلك يعكس تنوع الأنشطة أو حاجة لتعزيز المشاركة في المسار العربي.`
      );
    }
  }
  if (approvedRows.length > 0 && featuredRows.length > 0) {
    const f = featuredShareOfApprovedPct ?? 0;
    if (f < 15) {
      narrativeInsights.push(
        `نسبة التمييز من بين الإنجازات المعتمدة منخفضة نسبيًا (${f}%) — قد توجد فرص لرفع التمييز في مجالات باعتماد قوي بالفعل.`
      );
    }
  }

  const topTypes = rowsFromCounts(typeCount, typeTotal, (k) => ({
    ar: getDbAchievementTypeLabel(k, "ar"),
    en: getDbAchievementTypeLabel(k, "en"),
  })).slice(0, 5);
  const bottomTypes = rowsFromCounts(typeCount, typeTotal, (k) => ({
    ar: getDbAchievementTypeLabel(k, "ar"),
    en: getDbAchievementTypeLabel(k, "en"),
  })).slice(-3);
  if (topTypes.length && bottomTypes.length) {
    const hot = topTypes[0]?.labelAr;
    const cold = bottomTypes[0]?.labelAr;
    if (hot && cold && hot !== cold) {
      narrativeInsights.push(
        `أكثر أنواع الإدخال نشاطًا ضمن الإنجازات المعتمدة للعام الحالي: «${hot}»، بينما تبقى بعض الأنواع دونية التكرار مثل «${cold}» — يستحق النظر في دعم المشاركة أو التوثيق في الفئات الأقل نشاطًا.`
      );
    }
  }

  const breakdownGender = rowsFromCounts(genderCount, genderTotal, (k) => ({
    ar: labelGenderKey(k, true),
    en: labelGenderKey(k, false),
  }));
  const breakdownTrack = rowsFromCounts(trackCount, trackDenom, (k) => ({
    ar: labelTrackKey(k, true),
    en: labelTrackKey(k, false),
  }));
  const breakdownGrade = rowsFromCounts(gradeCount, gradeTotal, (k) => ({
    ar: getGradeLabel(k, "ar"),
    en: getGradeLabel(k, "en"),
  }));
  const breakdownStage = rowsFromCounts(stageCount, stageTotal, (k) => ({
    ar: labelStageKey(k, true),
    en: labelStageKey(k, false),
  }));
  const breakdownAchievementType = rowsFromCounts(typeCount, typeTotal, (k) => ({
    ar: getDbAchievementTypeLabel(k, "ar"),
    en: getDbAchievementTypeLabel(k, "en"),
  }));
  const breakdownAchievementLevel = rowsFromCounts(levelCount, levelTotal, (k) => ({
    ar: getAchievementLevelLabel(k, "ar"),
    en: getAchievementLevelLabel(k, "en"),
  }));
  const breakdownInferredField = rowsFromCounts(fieldCount, fieldTotal, (k) => ({
    ar: k === "—" ? "غير محدد" : labelInferredField(k, "ar"),
    en: k === "—" ? "Not specified" : labelInferredField(k, "en"),
  }));
  const breakdownStatusMix = rowsFromCounts(statusCounts, statusTotal, (k) => ({
    ar: labelStatusBucket(k, true),
    en: labelStatusBucket(k, false),
  }));

  const statusPending = statusCounts.pending || 0;
  const statusNeedsRevision = statusCounts.needs_revision || 0;
  const statusRejected = statusCounts.rejected || 0;

  const recommendations = buildAdvancedAnalyticsRecommendations({
    scopeYear: y,
    yearTotal,
    approvedInYear: approvedRows.length,
    featuredInYear: featuredRows.length,
    featuredShareOfApprovedPct,
    approvedShareOfYearPct,
    typeRows: breakdownAchievementType,
    fieldRows: breakdownInferredField,
    levelRows: breakdownAchievementLevel,
    stageRows: breakdownStage,
    gradeRows: breakdownGrade,
    arTrack,
    intlTrack,
    unspecifiedTrack,
    monthCounts,
    monthLabelsAr: MONTH_AR,
    statusPending,
    statusNeedsRevision,
    statusRejected,
    totalRecords: rows.length,
  });

  const advanced = {
    scopeYear: y,
    summary: {
      yearAchievementCount: yearTotal,
      approvedShareOfYearPct,
      featuredShareOfApprovedPct,
      avgApprovedPerActiveStudent,
      activeStudentsWithApprovedInYear,
    },
    comparison: {
      approvedInArabicTrack: arTrack,
      approvedInInternationalTrack: intlTrack,
      approvedUnspecifiedTrack: unspecifiedTrack,
      ratioArabicToInternational:
        intlTrack > 0 ? Math.round((arTrack / intlTrack) * 100) / 100 : null,
    },
    breakdowns: {
      gender: breakdownGender,
      track: breakdownTrack,
      grade: breakdownGrade,
      stage: breakdownStage,
      achievementType: breakdownAchievementType,
      achievementLevel: breakdownAchievementLevel,
      inferredField: breakdownInferredField,
    },
    statusMix: breakdownStatusMix,
    trends: {
      byAchievementYear: trendsByAchievementYear,
      byMonthInScopeYear,
    },
    narrativeInsights,
    recommendations,
  };

  return {
    year: y,
    totals: {
      achievementsThisYear: yearRows.length,
      approvedThisYear: approvedRows.length,
      featuredThisYear: featuredRows.length,
      pendingAll: pending,
      rejectedAll: rejected,
      needsRevisionAll: needsRev,
      approvalRateApprox: Math.round(reviewRatio * 1000) / 1000,
    },
    distributions: {
      gender: genderCount,
      track: trackCount,
      stage: stageCount,
      grade: gradeCount,
    },
    advanced,
  };
};

export const buildAdminAnalyticsInsights = async (): Promise<AdminInsightItem[]> => {
  await connectDB();
  const rows = (await Achievement.find({})
    .select(
      "userId studentProfileKey studentSnapshot achievementName nameAr status isFeatured featured achievementLevel inferredField achievementYear aiFlags"
    )
    .lean()) as unknown as Record<string, unknown>[];

  const insights: AdminInsightItem[] = [];
  const nowIso = new Date().toISOString();

  const dupCandidates = rows.filter(
    (r) => Array.isArray(r.aiFlags) && (r.aiFlags as string[]).includes(DUPLICATE_FLAG)
  );
  if (dupCandidates.length > 0) {
    insights.push({
      type: "duplicate_candidates",
      titleAr: "تنبيه: إنجازات مُعلّمة كمكررة محتملة",
      descriptionAr: `يوجد ${dupCandidates.length} سجل(ات) تحمل إشارة تكرار من النظام. راجع قائمة التنبيهات.`,
      priority: "medium",
      confidence: 0.75,
      category: "integrity",
      relatedAchievementIds: dupCandidates.slice(0, 40).map((r) => String(r._id)),
      createdAt: nowIso,
    });
  }

  const byUser = new Map<string, number>();
  for (const r of rows) {
    const uid = String(r.userId || "");
    if (!uid) continue;
    if (!approvedLike(r)) continue;
    byUser.set(uid, (byUser.get(uid) || 0) + 1);
  }
  const top = [...byUser.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length > 0) {
    insights.push({
      type: "highlight_students",
      titleAr: "طلاب بإنجازات معتمدة متكررة",
      descriptionAr: `تم رصد ${top.length} طالبًا لديهم 4 إنجازات معتمدة أو أكثر ضمن السجلات — مرشحون للتكريم أو المتابعة التحليلية.`,
      priority: "low",
      confidence: 0.55,
      category: "recognition",
      relatedStudentIds: top.map(([id]) => id),
      createdAt: nowIso,
    });
  }

  const fieldCountMap: Record<string, number> = {};
  for (const r of rows) {
    if (!approvedLike(r)) continue;
    const f = safeStr(r.inferredField) || "—";
    fieldCountMap[f] = (fieldCountMap[f] || 0) + 1;
  }
  const lowFields = Object.entries(fieldCountMap)
    .filter(([k, c]) => c <= 2 && k !== "—")
    .slice(0, 6);
  if (lowFields.length > 0) {
    const labels = lowFields.map(([k]) => (k === "—" ? "غير محدد" : labelInferredField(k, "ar")));
    insights.push({
      type: "low_activity_fields",
      titleAr: "مجالات إنجاز منخفضة النشاط",
      descriptionAr: `مجالات قليلة التكرار في السجلات المعتمدة: ${labels.join("، ")} — راجع التوازن بين المجالات.`,
      priority: "low",
      confidence: 0.5,
      category: "equity",
      createdAt: nowIso,
    });
  }

  const strongNotFeatured = rows.filter(
    (r) =>
      approvedLike(r) &&
      !isFeaturedRow(r) &&
      (safeStr(r.achievementLevel) === "international" || safeStr(r.achievementLevel) === "kingdom")
  );
  if (strongNotFeatured.length > 0) {
    insights.push({
      type: "media_worthy",
      titleAr: "إنجازات بمستوى مرتفع دون تمييز",
      descriptionAr: `يوجد ${strongNotFeatured.length} إنجاز(ات) بمستوى وطني أو دولي ومعتمدة دون تمييز — تستحق مراجعة للنشر المؤسسي أو التمييز.`,
      priority: "medium",
      confidence: 0.6,
      category: "communications",
      relatedAchievementIds: strongNotFeatured.slice(0, 30).map((r) => String(r._id)),
      createdAt: nowIso,
    });
  }

  return insights;
};
