/**
 * Aggregated admin dashboard metrics — Mongo aggregations + countDocuments only.
 */

import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { buildAdminAchievementListFilter } from "@/lib/adminAchievementListQuery";
import { formatAcademicYearLabel } from "@/lib/academic-year";
import {
  getAchievementAdminEventKey,
  getAchievementAdminEventLabel,
  getAchievementAdminFieldKey,
  getAchievementAdminFieldLabel,
} from "@/lib/achievement-admin-display";

/** Mirrors resolveWorkflowDisplayStatus bucket for donut / distribution (aggregation). */
const workflowBucketExpr: Record<string, unknown> = {
  $switch: {
    branches: [
      { case: { $eq: ["$status", "rejected"] }, then: "rejected" },
      {
        case: {
          $and: [
            { $eq: ["$pendingReReview", true] },
            {
              $or: [{ $eq: ["$status", "approved"] }, { $eq: ["$approved", true] }],
            },
          ],
        },
        then: "pending_re_review",
      },
      { case: { $eq: ["$verificationStatus", "verified"] }, then: "approved" },
      {
        case: { $eq: ["$verificationStatus", "pending_committee_review"] },
        then: "pending",
      },
      { case: { $eq: ["$status", "pending"] }, then: "pending" },
      { case: { $eq: ["$status", "pending_review"] }, then: "pending" },
      { case: { $eq: ["$status", "needs_revision"] }, then: "needs_revision" },
      {
        case: { $eq: ["$status", "approved"] },
        then: {
          $cond: [
            {
              $or: [
                { $eq: ["$isFeatured", true] },
                {
                  $and: [{ $eq: ["$featured", true] }, { $eq: ["$approved", true] }],
                },
              ],
            },
            "featured",
            "approved",
          ],
        },
      },
    ],
    default: {
      $cond: [
        { $and: [{ $eq: ["$approved", true] }, { $eq: ["$featured", true] }] },
        "featured",
        {
          $cond: [{ $eq: ["$approved", true] }, "approved", "pending"],
        },
      ],
    },
  },
};

const approvedOnlyFilter: Record<string, unknown> = {
  $and: [
    {
      $or: [
        { status: "approved" },
        {
          $and: [
            { $or: [{ status: { $exists: false } }, { status: null }] },
            { approved: true },
          ],
        },
      ],
    },
    {
      $nor: [
        { isFeatured: true },
        { $and: [{ featured: true }, { approved: true }] },
      ],
    },
  ],
};

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const previewFields =
  "nameAr nameEn achievementName title customAchievementName status updatedAt pendingReReview";

const fetchPreview = async (
  filter: Record<string, unknown>,
  limit: number
): Promise<Array<{ id: string; titleAr: string; titleEn: string; updatedAt: string | null }>> => {
  const rows = await Achievement.find(filter)
    .sort({ updatedAt: 1 })
    .limit(limit)
    .select(previewFields)
    .lean();
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r._id),
    titleAr: getAchievementAdminEventLabel(r, "ar"),
    titleEn: getAchievementAdminEventLabel(r, "en"),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : null,
  }));
};

export type AdminDashboardPayload = {
  stats: {
    totalAchievements: number;
    pendingReview: number;
    needsRevision: number;
    resubmitted: number;
    approved: number;
    featured: number;
    rejected: number;
    aiAlerts: number;
    totalUsers: number;
    duplicateSuspicion: number;
    attachmentUnclear: number;
    attachmentMismatch: number;
    stalePending: number;
  };
  byAcademicYear: Array<{
    key: string;
    startYear: number;
    count: number;
    isPeak: boolean;
    pctChangeFromPrevious: number | null;
  }>;
  byStatus: Array<{ key: string; count: number }>;
  byLevel: Array<{ key: string; count: number }>;
  byDomain: Array<{ key: string; labelAr: string; labelEn: string; count: number }>;
  byEventStudents: Array<{ eventKey: string; labelAr: string; labelEn: string; studentCount: number }>;
  usersByRole: Array<{ role: string; count: number }>;
  priorityQueue: {
    pendingReview: { count: number; items: Array<{ id: string; titleAr: string; titleEn: string }> };
    resubmitted: { count: number; items: Array<{ id: string; titleAr: string; titleEn: string }> };
    aiReview: { count: number; items: Array<{ id: string; titleAr: string; titleEn: string }> };
    stale: { count: number; items: Array<{ id: string; titleAr: string; titleEn: string }> };
  };
};

export const buildAdminDashboardPayload = async (): Promise<AdminDashboardPayload> => {
  await connectDB();

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_MS);

  const [
    totalAchievements,
    pendingReview,
    needsRevision,
    resubmitted,
    featured,
    approvedOnly,
    rejected,
    aiAlerts,
    totalUsers,
    duplicateSuspicion,
    attachmentUnclear,
    attachmentMismatch,
    stalePending,
  ] = await Promise.all([
    Achievement.countDocuments({}),
    Achievement.countDocuments(buildAdminAchievementListFilter("pending")),
    Achievement.countDocuments(buildAdminAchievementListFilter("needs_revision")),
    Achievement.countDocuments(buildAdminAchievementListFilter("pending_re_review")),
    Achievement.countDocuments(buildAdminAchievementListFilter("featured")),
    Achievement.countDocuments(approvedOnlyFilter),
    Achievement.countDocuments(buildAdminAchievementListFilter("rejected")),
    Achievement.countDocuments(buildAdminAchievementListFilter("ai_flagged")),
    User.countDocuments({}),
    Achievement.countDocuments(buildAdminAchievementListFilter("duplicate")),
    Achievement.countDocuments(buildAdminAchievementListFilter("attachment_ai_unclear")),
    Achievement.countDocuments(buildAdminAchievementListFilter("attachment_ai_mismatch")),
    Achievement.countDocuments({
      $and: [
        buildAdminAchievementListFilter("pending"),
        { updatedAt: { $lt: staleBefore } },
      ],
    }),
  ]);

  const [byYearAgg, byBucketAgg, byLevelAgg, byFieldRawAgg, byEventStudentRawAgg, usersByRoleAgg] = await Promise.all([
    Achievement.aggregate([
      {
        $addFields: {
          refDate: {
            $ifNull: ["$date", "$createdAt"],
          },
        },
      },
      {
        $match: {
          refDate: { $exists: true, $ne: null },
        },
      },
      {
        $addFields: {
          ayStart: {
            $cond: [
              { $gte: [{ $month: "$refDate" }, 8] },
              { $year: "$refDate" },
              { $subtract: [{ $year: "$refDate" }, 1] },
            ],
          },
        },
      },
      { $group: { _id: "$ayStart", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).exec(),
    Achievement.aggregate([
      { $addFields: { wfBucket: workflowBucketExpr } },
      { $group: { _id: "$wfBucket", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec(),
    Achievement.aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$achievementLevel", "$level"],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).exec(),
    Achievement.aggregate([
      {
        $project: {
          coalesced: {
            $let: {
              vars: {
                i: { $toString: { $ifNull: ["$inferredField", ""] } },
                d: { $toString: { $ifNull: ["$domain", ""] } },
                o: { $toString: { $ifNull: ["$olympiadField", ""] } },
              },
              in: {
                $cond: [
                  { $gt: [{ $strLenCP: "$$i" }, 0] },
                  "$$i",
                  {
                    $cond: [{ $gt: [{ $strLenCP: "$$d" }, 0] }, "$$d", "$$o"],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          norm: { $toLower: { $trim: { input: "$coalesced" } } },
        },
      },
      { $group: { _id: "$norm", count: { $sum: 1 } } },
    ]).exec(),
    Achievement.aggregate([
      {
        $project: {
          userId: 1,
          nameAr: 1,
          nameEn: 1,
          achievementName: 1,
          customAchievementName: 1,
          title: 1,
        },
      },
    ]).exec(),
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }, { $sort: { count: -1 } }]).exec(),
  ]);

  const byAcademicYearRaw = (byYearAgg as { _id: number; count: number }[]).map((r) => ({
    startYear: r._id,
    count: r.count,
    key: formatAcademicYearLabel(r._id),
  }));

  let maxCount = 0;
  for (const r of byAcademicYearRaw) {
    if (r.count > maxCount) maxCount = r.count;
  }

  const byAcademicYear = byAcademicYearRaw.map((r, i) => {
    const prev = i > 0 ? byAcademicYearRaw[i - 1].count : null;
    const pctChangeFromPrevious =
      prev !== null && prev > 0 ? Math.round(((r.count - prev) / prev) * 1000) / 10 : null;
    return {
      key: r.key,
      startYear: r.startYear,
      count: r.count,
      isPeak: r.count === maxCount && maxCount > 0,
      pctChangeFromPrevious,
    };
  });

  const byStatus = (byBucketAgg as { _id: string; count: number }[])
    .filter((x) => x._id)
    .map((x) => ({ key: x._id, count: x.count }));

  const byLevel = (byLevelAgg as { _id: string; count: number }[])
    .map((x) => ({ key: String(x._id || "unknown"), count: x.count }))
    .filter((x) => x.key !== "null");

  const byDomain = (byFieldRawAgg as { _id: string; count: number }[])
    .map((row) => {
      const rec = { inferredField: row._id };
      return {
        key: getAchievementAdminFieldKey(rec),
        labelAr: getAchievementAdminFieldLabel(rec, "ar"),
        labelEn: getAchievementAdminFieldLabel(rec, "en"),
        count: row.count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const eventAcc = new Map<
    string,
    { eventKey: string; labelAr: string; labelEn: string; students: Set<string> }
  >();
  for (const row of byEventStudentRawAgg as Record<string, unknown>[]) {
    const userId = String(row.userId || "");
    if (!userId) continue;
    const eventKey = getAchievementAdminEventKey(row);
    const hit = eventAcc.get(eventKey) || {
      eventKey,
      labelAr: getAchievementAdminEventLabel(row, "ar"),
      labelEn: getAchievementAdminEventLabel(row, "en"),
      students: new Set<string>(),
    };
    hit.students.add(userId);
    eventAcc.set(eventKey, hit);
  }

  const byEventStudents = [...eventAcc.values()]
    .map((x) => ({
      eventKey: x.eventKey,
      labelAr: x.labelAr,
      labelEn: x.labelEn,
      studentCount: x.students.size,
    }))
    .filter((x) => x.studentCount > 0)
    .sort((a, b) => b.studentCount - a.studentCount);

  const roleCountMap = new Map<string, number>();
  for (const x of usersByRoleAgg as { _id: string; count: number }[]) {
    roleCountMap.set(String(x._id || "unknown"), x.count);
  }
  /** All platform roles — always returned (0 if none) for admin dashboard clarity. */
  const USER_ROLE_ORDER = ["student", "judge", "teacher", "schoolAdmin", "admin", "supervisor"] as const;
  const usersByRole = USER_ROLE_ORDER.map((role) => ({
    role,
    count: roleCountMap.get(role) ?? 0,
  }));

  const pendingF = buildAdminAchievementListFilter("pending");
  const resubF = buildAdminAchievementListFilter("pending_re_review");
  const aiF = buildAdminAchievementListFilter("ai_flagged");
  const staleF = {
    $and: [pendingF, { updatedAt: { $lt: staleBefore } }],
  };

  const [pPrev, rPrev, aPrev, sPrev] = await Promise.all([
    fetchPreview(pendingF, 5),
    fetchPreview(resubF, 5),
    fetchPreview(aiF, 5),
    fetchPreview(staleF, 5),
  ]);

  const toItems = (rows: typeof pPrev) =>
    rows.map((x) => ({ id: x.id, titleAr: x.titleAr || "—", titleEn: x.titleEn || "—" }));

  return {
    stats: {
      totalAchievements,
      pendingReview,
      needsRevision,
      resubmitted,
      approved: approvedOnly,
      featured,
      rejected,
      aiAlerts,
      totalUsers,
      duplicateSuspicion,
      attachmentUnclear,
      attachmentMismatch,
      stalePending,
    },
    byAcademicYear,
    byStatus,
    byLevel,
    byDomain,
    byEventStudents,
    usersByRole,
    priorityQueue: {
      pendingReview: { count: pendingReview, items: toItems(pPrev) },
      resubmitted: { count: resubmitted, items: toItems(rPrev) },
      aiReview: { count: aiAlerts, items: toItems(aPrev) },
      stale: { count: stalePending, items: toItems(sPrev) },
    },
  };
};
