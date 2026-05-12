import User from "@/models/User";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import {
  getAdminAlumniOverview,
  getAdminAlumniEngagementIntel,
  type EngagementIntel,
} from "@/lib/alumni/admin-alumni-analytics";
import { listAlumniSnapshots } from "@/lib/alumni/analytics/historical-metrics";
import { computeExecutiveAlertsFromSnapshots, type ExecutiveAlert } from "@/lib/alumni/analytics/executive-alerts";

const activeAlumniMatch = (): Record<string, unknown> => ({
  $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()],
});

export type AlumniCommunityHealth = {
  moderationBacklog: number;
  verificationBacklog: number;
  staleCohortYears: number[];
  lowMentorshipActivity: boolean;
  weakEventEngagement: boolean;
  dormantAlumniApproxPercent: number;
  notesAr: string[];
  notesEn: string[];
};

export type ExecutiveAlumniDashboard = {
  overview: import("@/lib/alumni/admin-alumni-analytics").AdminAlumniOverview;
  engagement: EngagementIntel;
  verificationRatePercent: number;
  avgReputation: number;
  profileCompletionRatePercent: number;
  registration: {
    last7d: number;
    prev7d: number;
    deltaPercent: number | null;
  };
  topCountries: { name: string; count: number }[];
  snapshotTrend: {
    alumniCountDelta: number | null;
    latestWeeklyPeriod: string | null;
  };
  communityHealth: AlumniCommunityHealth;
  executiveAlerts: ExecutiveAlert[];
};

export const getExecutiveAlumniDashboard = async (): Promise<ExecutiveAlumniDashboard> => {
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400000);
  const d14 = new Date(now - 14 * 86400000);
  const d90 = new Date(now - 90 * 86400000);

  const [
    overview,
    engagement,
    alumniCountForRate,
    verifiedCountForRate,
    avgRepAgg,
    profileCompleteCount,
    regLast7,
    regPrev7,
    topCountries,
    dormantCount,
    weeklySnapshots,
    monthlySnapshots,
  ] = await Promise.all([
    getAdminAlumniOverview(),
    getAdminAlumniEngagementIntel(),
    User.countDocuments(activeAlumniMatch()),
    User.countDocuments({
      $and: [
        { accountType: "alumni" },
        alumniCommunityActiveUserClause(),
        { "alumniProfile.isVerifiedAlumni": true },
      ],
    }),
    User.aggregate<{ v: number | null }>([
      { $match: activeAlumniMatch() },
      { $group: { _id: null as unknown as string, v: { $avg: "$alumniProfile.reputationScore" } } },
    ]),
    User.countDocuments({
      $and: [
        activeAlumniMatch(),
        { "alumniProfile.universityName": { $exists: true, $nin: [null, ""] } },
        { "alumniProfile.major": { $exists: true, $nin: [null, ""] } },
        { "alumniProfile.graduationYear": { $exists: true, $nin: [null, ""] } },
        { "alumniProfile.currentCompany": { $exists: true, $nin: [null, ""] } },
        { "alumniProfile.industry": { $exists: true, $nin: [null, ""] } },
        {
          $or: [
            { "alumniProfile.country": { $exists: true, $nin: [null, ""] } },
            { "alumniProfile.studyCountry": { $exists: true, $nin: [null, ""] } },
          ],
        },
      ],
    }),
    User.countDocuments({
      $and: [activeAlumniMatch(), { createdAt: { $gte: d7 } }],
    }),
    User.countDocuments({
      $and: [activeAlumniMatch(), { createdAt: { $gte: d14, $lt: d7 } }],
    }),
    User.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          $and: [
            { accountType: "alumni" },
            alumniCommunityActiveUserClause(),
            {
              $or: [
                { "alumniProfile.country": { $exists: true, $nin: [null, ""] } },
                { "alumniProfile.studyCountry": { $exists: true, $nin: [null, ""] } },
              ],
            },
          ],
        },
      },
      {
        $project: {
          c: {
            $ifNull: ["$alumniProfile.country", "$alumniProfile.studyCountry"],
          },
        },
      },
      { $match: { c: { $nin: [null, ""] } } },
      { $group: { _id: "$c", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    User.countDocuments({
      $and: [
        activeAlumniMatch(),
        {
          $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }, { lastLoginAt: { $lt: d90 } }],
        },
      ],
    }),
    listAlumniSnapshots("weekly", 4),
    listAlumniSnapshots("monthly", 10),
  ]);

  const verificationRatePercent =
    alumniCountForRate > 0 ? Math.round((verifiedCountForRate / alumniCountForRate) * 1000) / 10 : 0;
  const avgReputation = Math.round((avgRepAgg[0]?.v || 0) * 10) / 10;
  const profileCompletionRatePercent =
    alumniCountForRate > 0 ? Math.round((profileCompleteCount / alumniCountForRate) * 1000) / 10 : 0;

  let deltaPercent: number | null = null;
  if (regPrev7 > 0) {
    deltaPercent = Math.round(((regLast7 - regPrev7) / regPrev7) * 1000) / 10;
  } else if (regLast7 > 0) {
    deltaPercent = 100;
  }

  const dormantAlumniApproxPercent =
    alumniCountForRate > 0 ? Math.round((dormantCount / alumniCountForRate) * 1000) / 10 : 0;

  const staleCohortYears = overview.cohortSizes.filter((c) => c.count <= 2 && c.year > 1970).map((c) => c.year);

  const moderationBacklog =
    overview.memoryStatusCounts.pending +
    overview.opportunityCounts.pendingReview +
    overview.verificationTicketCounts.pending;

  const lowMentorshipActivity = engagement.mentorshipRequestsLast30d < 3 && overview.alumniCount > 40;
  const weakEventEngagement =
    engagement.attendanceRatePercent > 0 && engagement.attendanceRatePercent < 25 && engagement.rsvpTotal >= 8;

  const notesAr: string[] = [];
  const notesEn: string[] = [];
  if (moderationBacklog >= 15) {
    notesAr.push("طابور الإشراف مرتفع — راجع الذكريات والفرص والتوثيق.");
    notesEn.push("Moderation backlog is elevated — review memories, opportunities, and verification.");
  }
  if (dormantAlumniApproxPercent >= 45) {
    notesAr.push("حصة كبيرة من الخريجين بلا نشاط دخول خلال 90 يومًا.");
    notesEn.push("A large share of alumni have no login activity within 90 days.");
  }
  if (staleCohortYears.length >= 4) {
    notesAr.push("عدة دفعات صغيرة جدًا قد تحتاج حملات تفعيل موجهة.");
    notesEn.push("Several very small cohorts may need targeted activation campaigns.");
  }

  let alumniCountDelta: number | null = null;
  let latestWeeklyPeriod: string | null = null;
  if (weeklySnapshots.length >= 2) {
    const sorted = [...weeklySnapshots].sort(
      (a: { periodStart?: Date }, b: { periodStart?: Date }) =>
        new Date(b.periodStart || 0).getTime() - new Date(a.periodStart || 0).getTime()
    );
    const a0 = (sorted[0]?.payload as { overview?: { alumniCount?: number } })?.overview?.alumniCount;
    const a1 = (sorted[1]?.payload as { overview?: { alumniCount?: number } })?.overview?.alumniCount;
    if (typeof a0 === "number" && typeof a1 === "number") {
      alumniCountDelta = a0 - a1;
    }
    if (sorted[0]?.periodStart) {
      latestWeeklyPeriod = new Date(sorted[0].periodStart as Date).toISOString().slice(0, 10);
    }
  }

  const monthlySorted = [...monthlySnapshots].sort(
    (a: { periodStart?: Date }, b: { periodStart?: Date }) =>
      new Date(b.periodStart || 0).getTime() - new Date(a.periodStart || 0).getTime()
  );
  const executiveAlerts = computeExecutiveAlertsFromSnapshots(
    monthlySorted.map((row: { periodStart?: Date; payload?: unknown }) => ({
      periodStart: row.periodStart as Date,
      payload: row.payload as Record<string, unknown>,
    }))
  );

  return {
    overview,
    engagement,
    verificationRatePercent,
    avgReputation,
    profileCompletionRatePercent,
    registration: {
      last7d: regLast7,
      prev7d: regPrev7,
      deltaPercent,
    },
    topCountries: topCountries.map((r) => ({ name: r._id, count: r.count })),
    snapshotTrend: {
      alumniCountDelta,
      latestWeeklyPeriod,
    },
    communityHealth: {
      moderationBacklog,
      verificationBacklog: overview.verificationTicketCounts.pending,
      staleCohortYears,
      lowMentorshipActivity,
      weakEventEngagement,
      dormantAlumniApproxPercent,
      notesAr,
      notesEn,
    },
    executiveAlerts,
  };
};
