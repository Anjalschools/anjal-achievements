import type { ExecutiveSnapshotGranularity } from "@/models/ExecutiveAnalyticsSnapshot";

export const utcDayBounds = (d: Date) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

export const utcWeekBounds = (d: Date) => {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
};

export const utcMonthBounds = (d: Date) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
};

export const boundsForExecutiveGranularity = (g: ExecutiveSnapshotGranularity, ref: Date) => {
  if (g === "weekly") return utcWeekBounds(ref);
  if (g === "monthly") return utcMonthBounds(ref);
  return utcDayBounds(ref);
};
