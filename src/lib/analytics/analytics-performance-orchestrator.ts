/**
 * Analytics performance orchestrator — section scheduling & deferred execution.
 */

export type AnalyticsPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "BACKGROUND" | "IDLE";

const LOG = process.env.NODE_ENV !== "production";

type ScheduledTask = {
  id: string;
  priority: AnalyticsPriority;
  run: () => void;
};

const priorityOrder: Record<AnalyticsPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  BACKGROUND: 3,
  IDLE: 4,
};

const queue: ScheduledTask[] = [];
let flushing = false;

const flushQueue = () => {
  if (flushing || queue.length === 0) return;
  flushing = true;
  queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const batch = queue.splice(0, 8);
  for (const task of batch) {
    try {
      task.run();
    } catch (e) {
      if (LOG) console.warn("[analytics-performance] task failed", task.id, e);
    }
  }
  flushing = false;
  if (queue.length > 0) scheduleFlush();
};

const scheduleFlush = () => {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => flushQueue(), { timeout: 120 });
    return;
  }
  setTimeout(flushQueue, 0);
};

export const scheduleAnalyticsWork = (
  id: string,
  priority: AnalyticsPriority,
  run: () => void
): void => {
  queue.push({ id, priority, run });
  if (priority === "CRITICAL") {
    run();
    return;
  }
  if (priority === "HIGH") {
    queueMicrotask(flushQueue);
    return;
  }
  scheduleFlush();
};

export const getAnalyticsQueueDepth = (): number => queue.length;
