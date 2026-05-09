import AlumniAnalyticsSnapshot from "@/models/AlumniAnalyticsSnapshot";
import type { AlumniSnapshotGranularity } from "@/models/AlumniAnalyticsSnapshot";
import {
  getAdminAlumniOverview,
  getAdminAlumniUniversitiesIntel,
  getAdminAlumniCareersIntel,
  getAdminAlumniEngagementIntel,
} from "@/lib/alumni/admin-alumni-analytics";

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

export const boundsForGranularity = (g: AlumniSnapshotGranularity, ref: Date) => {
  if (g === "daily") return utcDayBounds(ref);
  if (g === "weekly") return utcWeekBounds(ref);
  return utcMonthBounds(ref);
};

export const buildSnapshotPayload = async (): Promise<Record<string, unknown>> => {
  const [overview, universities, careers, engagement] = await Promise.all([
    getAdminAlumniOverview(),
    getAdminAlumniUniversitiesIntel(),
    getAdminAlumniCareersIntel(),
    getAdminAlumniEngagementIntel(),
  ]);
  return {
    computedAt: new Date().toISOString(),
    overview,
    universitiesTop: universities.items.slice(0, 12),
    careers,
    engagement,
  };
};

export const upsertAlumniAnalyticsSnapshot = async (
  granularity: AlumniSnapshotGranularity,
  refDate = new Date()
): Promise<{ id: string }> => {
  const { start, end } = boundsForGranularity(granularity, refDate);
  const payload = await buildSnapshotPayload();
  const doc = await AlumniAnalyticsSnapshot.findOneAndUpdate(
    { granularity, periodStart: start },
    {
      $set: {
        periodEnd: end,
        payload,
        payloadVersion: 1,
      },
    },
    { upsert: true, new: true }
  ).lean();
  return { id: String((doc as { _id: unknown })._id) };
};
