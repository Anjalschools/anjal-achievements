/**
 * Background analytics worker — idle-time heavy scoring (main-thread fallback).
 */

export type BackgroundJob<T> = {
  id: string;
  run: () => T;
  onComplete: (result: T) => void;
};

const runOnIdle = (fn: () => void): void => {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => fn(), { timeout: 200 });
    return;
  }
  setTimeout(fn, 16);
};

export const enqueueBackgroundAnalytics = <T>(job: BackgroundJob<T>): void => {
  runOnIdle(() => {
    try {
      const result = job.run();
      job.onComplete(result);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[analytics-performance] background job failed", job.id, e);
      }
    }
  });
};
