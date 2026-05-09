type CounterKey = "enqueued" | "processed" | "failed" | "retried" | "deadLettered";

const state: Record<CounterKey, number> = {
  enqueued: 0,
  processed: 0,
  failed: 0,
  retried: 0,
  deadLettered: 0,
};

export const queueMetrics = {
  incr(key: CounterKey, n = 1) {
    state[key] += n;
  },
  snapshot() {
    return { ...state };
  },
  reset() {
    (Object.keys(state) as CounterKey[]).forEach((k) => {
      state[k] = 0;
    });
  },
};

export type QueueHealthSnapshot = {
  metrics: ReturnType<typeof queueMetrics.snapshot>;
  /** Placeholder for future Redis/BullMQ latency probes */
  provider: string;
};

export const getQueueHealthSnapshot = (): QueueHealthSnapshot => ({
  metrics: queueMetrics.snapshot(),
  provider: process.env.QUEUE_PROVIDER?.trim() || "local",
});
