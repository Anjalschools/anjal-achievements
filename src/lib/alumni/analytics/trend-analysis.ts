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
