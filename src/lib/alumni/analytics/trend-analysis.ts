export type GrowthPoint = {
  periodStart: string;
  alumniCount: number;
  verifiedCount: number;
  mentorshipTotal: number;
  storiesPublished: number;
};

type SnapshotRow = { periodStart: Date; payload?: Record<string, unknown> };

export const snapshotsToGrowthSeries = (rows: SnapshotRow[]): GrowthPoint[] =>
  [...rows]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
    .map((r) => {
      const p = (r.payload || {}) as {
        overview?: {
          alumniCount?: number;
          alumniVerifiedCount?: number;
          mentorshipTotal?: number;
          storiesPublished?: number;
        };
      };
      const o = p.overview || {};
      return {
        periodStart: new Date(r.periodStart).toISOString(),
        alumniCount: Number(o.alumniCount || 0),
        verifiedCount: Number(o.alumniVerifiedCount || 0),
        mentorshipTotal: Number(o.mentorshipTotal || 0),
        storiesPublished: Number(o.storiesPublished || 0),
      };
    });

export type StrategicSeriesPoint = {
  periodStart: string;
  alumniCount: number;
  verifiedRatePercent: number | null;
  avgReputation: number | null;
  mentorshipRequestsLast30d: number | null;
  attendanceRatePercent: number | null;
  moderationBacklog: number | null;
};

export const snapshotsToStrategicSeries = (rows: SnapshotRow[]): StrategicSeriesPoint[] =>
  [...rows]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
    .map((r) => {
      const p = (r.payload || {}) as {
        overview?: {
          alumniCount?: number;
          alumniVerifiedCount?: number;
        };
        engagement?: {
          mentorshipRequestsLast30d?: number;
          attendanceRatePercent?: number;
        };
        kpis?: {
          verificationRatePercent?: number;
          avgReputation?: number;
        };
        communityHealth?: { moderationBacklog?: number };
      };
      const o = p.overview || {};
      const e = p.engagement || {};
      const k = p.kpis || {};
      const h = p.communityHealth || {};
      const ac = Number(o.alumniCount || 0);
      const vc = Number(o.alumniVerifiedCount || 0);
      const verifiedRatePercent = ac > 0 ? Math.round((vc / ac) * 1000) / 10 : null;
      return {
        periodStart: new Date(r.periodStart).toISOString(),
        alumniCount: ac,
        verifiedRatePercent: typeof k.verificationRatePercent === "number" ? k.verificationRatePercent : verifiedRatePercent,
        avgReputation: typeof k.avgReputation === "number" ? k.avgReputation : null,
        mentorshipRequestsLast30d:
          typeof e.mentorshipRequestsLast30d === "number" ? e.mentorshipRequestsLast30d : null,
        attendanceRatePercent: typeof e.attendanceRatePercent === "number" ? e.attendanceRatePercent : null,
        moderationBacklog: typeof h.moderationBacklog === "number" ? h.moderationBacklog : null,
      };
    });

export const topIndustryTrend = (
  rows: SnapshotRow[]
): { periodStart: string; topIndustry: string; count: number }[] =>
  [...rows]
    .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime())
    .map((r) => {
      const p = (r.payload || {}) as {
        careers?: { topIndustries?: { name: string; count: number }[] };
      };
      const top = p.careers?.topIndustries?.[0];
      return {
        periodStart: new Date(r.periodStart).toISOString(),
        topIndustry: top?.name || "—",
        count: top?.count ?? 0,
      };
    });
