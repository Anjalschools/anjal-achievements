import { queueMetrics } from "./queue-metrics";
import type { DeadLetterHandler } from "./dead-letter-handler";
import { defaultRetryPolicy, delayForAttempt } from "./retry-policy";
import type { RetryPolicy } from "./retry-policy";

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export class JobDispatcher {
  private readonly handlers = new Map<string, JobHandler>();

  register(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  async dispatch(
    type: string,
    payload: Record<string, unknown>,
    opts?: { dlq?: DeadLetterHandler; retry?: RetryPolicy }
  ): Promise<void> {
    const handler = this.handlers.get(type);
    if (!handler) return;
    const retry = opts?.retry ?? defaultRetryPolicy;
    const dlq = opts?.dlq;

    queueMetrics.incr("enqueued");
    let lastErr: Error | null = null;
    for (let i = 1; i <= retry.maxAttempts; i += 1) {
      try {
        await handler(payload);
        queueMetrics.incr("processed");
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error("unknown");
        queueMetrics.incr("failed");
        if (i < retry.maxAttempts) {
          queueMetrics.incr("retried");
          await new Promise((r) => setTimeout(r, delayForAttempt(retry, i)));
        }
      }
    }

    if (dlq && lastErr) {
      dlq.push({
        type,
        payload,
        error: lastErr.message.slice(0, 2000),
        at: new Date(),
        attempts: retry.maxAttempts,
      });
      queueMetrics.incr("deadLettered");
    }
  }
}

/** Names aligned with future external workers (BullMQ / Trigger.dev). */
export const QUEUE_NAMES = {
  campaign: "campaign",
  email: "email",
  recommendation: "recommendation",
  analytics: "analytics",
  reminder: "reminder",
  export: "export",
} as const;
