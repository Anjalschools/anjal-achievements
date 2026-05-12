import type { AlumniCommunityHealth } from "@/lib/alumni/executive-alumni-dashboard";

export type ExecutiveAlert = {
  code: string;
  severity: "info" | "warning" | "critical";
  messageAr: string;
  messageEn: string;
};

type SnapshotLite = {
  periodStart: Date;
  payload?: Record<string, unknown>;
};

const asOverview = (p: Record<string, unknown>) =>
  (p.overview || {}) as {
    alumniCount?: number;
    alumniVerifiedCount?: number;
    mentorshipTotal?: number;
    storiesPublished?: number;
    memoryStatusCounts?: { pending?: number };
    opportunityCounts?: { pendingReview?: number };
  };

const asEngagement = (p: Record<string, unknown>) =>
  (p.engagement || {}) as {
    mentorshipRequestsLast30d?: number;
    attendanceRatePercent?: number;
    rsvpTotal?: number;
  };

const asHealth = (p: Record<string, unknown>): AlumniCommunityHealth | null =>
  (p.communityHealth as AlumniCommunityHealth | undefined) ?? null;

const asKpis = (p: Record<string, unknown>) =>
  (p.kpis || {}) as {
    verificationRatePercent?: number;
    avgReputation?: number;
  };

/**
 * Compare latest vs previous persisted snapshots (monthly recommended).
 */
export const computeExecutiveAlertsFromSnapshots = (sortedNewestFirst: SnapshotLite[]): ExecutiveAlert[] => {
  const alerts: ExecutiveAlert[] = [];
  if (!sortedNewestFirst.length) return alerts;

  const latest = sortedNewestFirst[0];
  const prev = sortedNewestFirst[1];
  const lp = (latest.payload || {}) as Record<string, unknown>;
  const lo = asOverview(lp);
  const le = asEngagement(lp);
  const lh = asHealth(lp);
  const lk = asKpis(lp);

  if (lh?.moderationBacklog != null && lh.moderationBacklog >= 25) {
    alerts.push({
      code: "moderation_backlog_high",
      severity: "warning",
      messageAr: `طابور الإشراف مرتفع (${lh.moderationBacklog}). راجع الذكريات والفرص والتوثيق.`,
      messageEn: `Moderation backlog is high (${lh.moderationBacklog}). Review memories, opportunities, and verification.`,
    });
  }
  if (lh?.dormantAlumniApproxPercent != null && lh.dormantAlumniApproxPercent >= 50) {
    alerts.push({
      code: "dormant_alumni_high",
      severity: "warning",
      messageAr: `تقدير الخمول مرتفع (~${lh.dormantAlumniApproxPercent}% بدون دخول 90 يومًا).`,
      messageEn: `Dormant alumni estimate is high (~${lh.dormantAlumniApproxPercent}% with no login in ~90 days).`,
    });
  }
  if (lh?.lowMentorshipActivity) {
    alerts.push({
      code: "mentorship_low",
      severity: "info",
      messageAr: "نشاط طلبات الإرشاد خلال 30 يومًا منخفض مقارنة بحجم المجتمع.",
      messageEn: "Mentorship request volume over the last 30 days is low relative to community size.",
    });
  }

  if (!prev?.payload) return alerts;

  const pp = (prev.payload || {}) as Record<string, unknown>;
  const po = asOverview(pp);
  const pe = asEngagement(pp);
  const pk = asKpis(pp);

  const ac = Number(lo.alumniCount || 0) - Number(po.alumniCount || 0);
  if (ac < -5) {
    alerts.push({
      code: "alumni_count_drop",
      severity: "critical",
      messageAr: `انخفاض عدد الخريجين النشطين بين لقطتين (${ac}).`,
      messageEn: `Active alumni count dropped between snapshots (${ac}).`,
    });
  }

  const vr = Number(lk.verificationRatePercent ?? 0) - Number(pk.verificationRatePercent ?? 0);
  if (vr < -4) {
    alerts.push({
      code: "verification_rate_drop",
      severity: "warning",
      messageAr: `تراجع نسبة التوثيق بين اللقطتين (${vr.toFixed(1)} نقطة مئوية).`,
      messageEn: `Verification rate declined between snapshots (${vr.toFixed(1)} percentage points).`,
    });
  }

  const m30 = Number(le.mentorshipRequestsLast30d || 0) - Number(pe.mentorshipRequestsLast30d || 0);
  if (m30 < -4 && Number(le.mentorshipRequestsLast30d || 0) < 8) {
    alerts.push({
      code: "mentorship_requests_drop",
      severity: "warning",
      messageAr: `تراجع طلبات الإرشاد (30 يومًا) بين اللقطتين (${m30}).`,
      messageEn: `Mentorship requests (30d) dropped between snapshots (${m30}).`,
    });
  }

  const att = Number(le.attendanceRatePercent || 0) - Number(pe.attendanceRatePercent || 0);
  if (Number(le.rsvpTotal || 0) >= 10 && att < -12) {
    alerts.push({
      code: "event_engagement_drop",
      severity: "info",
      messageAr: `انخفاض معدل RSVP “حاضر” رغم وجود حجوزات (${att.toFixed(1)} نقطة).`,
      messageEn: `RSVP “going” rate declined despite meaningful RSVP volume (${att.toFixed(1)} pts).`,
    });
  }

  const rep = Number(lk.avgReputation || 0) - Number(pk.avgReputation || 0);
  if (rep < -8) {
    alerts.push({
      code: "avg_reputation_drop",
      severity: "info",
      messageAr: `انخفاض متوسط السمعة بين اللقطتين (${rep.toFixed(1)}).`,
      messageEn: `Average reputation declined between snapshots (${rep.toFixed(1)}).`,
    });
  }

  return alerts;
};
