import "server-only";
import connectDB from "@/lib/mongodb";
import CronJobLock from "@/models/CronJobLock";
import { createCorrelationId } from "@/lib/competition-intelligence-debug";
import { logRouteError } from "@/lib/resilience/route-error-log";

export type CronLockResult<T> =
  | { ran: true; holder: string; result: T }
  | { ran: false; skipped: true; reason: "overlap" | "timeout" };

export const acquireCronLock = async (
  jobKey: string,
  ttlMs: number
): Promise<{ acquired: boolean; holder: string }> => {
  await connectDB();
  const holder = createCorrelationId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  await CronJobLock.deleteMany({ expiresAt: { $lt: now } });

  const existing = await CronJobLock.findOne({ jobKey }).lean();
  if (existing && new Date(existing.expiresAt).getTime() > now.getTime()) {
    return { acquired: false, holder: String(existing.holder) };
  }

  try {
    await CronJobLock.findOneAndUpdate(
      { jobKey },
      { $set: { holder, lockedAt: now, expiresAt } },
      { upsert: true, new: true }
    );
    return { acquired: true, holder };
  } catch {
    return { acquired: false, holder };
  }
};

export const releaseCronLock = async (jobKey: string, holder: string) => {
  await connectDB();
  await CronJobLock.deleteOne({ jobKey, holder });
};

export const withCronLock = async <T>(
  jobKey: string,
  ttlMs: number,
  path: string,
  fn: () => Promise<T>
): Promise<CronLockResult<T>> => {
  const t0 = Date.now();
  const lock = await acquireCronLock(jobKey, ttlMs);
  if (!lock.acquired) {
    logRouteError({
      path,
      durationMs: Date.now() - t0,
      correlationId: lock.holder,
      cause: "cron_overlap",
      message: `cron skipped: ${jobKey}`,
    });
    return { ran: false, skipped: true, reason: "overlap" };
  }
  try {
    const result = await fn();
    return { ran: true, holder: lock.holder, result };
  } finally {
    await releaseCronLock(jobKey, lock.holder);
  }
};
