/**
 * Queue provider abstraction — swap local in-process / BullMQ / Trigger.dev without changing callers.
 */

export type QueueEnvelope = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: Date;
};

export type QueueProvider = {
  readonly kind: "local" | "bullmq" | "trigger";
  enqueue(type: string, payload: Record<string, unknown>): Promise<string>;
  /** Optional drain hook; no-op for external workers. */
  processNext?(): Promise<boolean>;
};

const randomId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const createLocalQueueProvider = (store: QueueEnvelope[] = []): QueueProvider => ({
  kind: "local",
  async enqueue(type, payload) {
    const id = randomId();
    store.push({ id, type, payload, attempts: 0, createdAt: new Date() });
    return id;
  },
  async processNext() {
    return false;
  },
});

export const describeBullMqMigration = (): string =>
  "Map enqueue() to Queue.add; run workers in a separate Node process; reuse JobDispatcher for handlers.";

export const describeTriggerDevMigration = (): string =>
  "Map enqueue() to trigger tasks; keep payload JSON-serializable; DLQ via Trigger failure hooks.";
