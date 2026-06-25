import type {
  BackupJobQueue,
  BackupJobQueueItem,
  BackupJobQueuePayload,
} from "@/lib/disaster-recovery/worker/dr-job-queue-types";

type MemoryEntry = {
  queueEntryId: string;
  payload: BackupJobQueuePayload;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  workerId?: string;
  nextRetryAt?: number;
};

export const createInMemoryBackupJobQueue = (): BackupJobQueue => {
  const entries = new Map<string, MemoryEntry>();
  let entryCounter = 0;

  const findQueued = (): MemoryEntry | undefined => {
    const now = Date.now();
    return Array.from(entries.values()).find(
      (entry) =>
        entry.status === "queued" && (!entry.nextRetryAt || entry.nextRetryAt <= now)
    );
  };

  return {
    async enqueue(payload) {
      if (entries.has(payload.recordId)) {
        const existing = entries.get(payload.recordId);
        if (existing && existing.status !== "failed" && existing.status !== "cancelled") {
          return;
        }
      }
      entryCounter += 1;
      entries.set(payload.recordId, {
        queueEntryId: `mem-${entryCounter}`,
        payload,
        status: "queued",
        attempts: 0,
        maxAttempts: 1,
      });
      console.info("[DR] QUEUE_PERSISTED", { jobId: payload.recordId, memory: true });
      console.info("[DR] QUEUE_ENQUEUED", {
        jobId: payload.recordId,
        queueSize: entries.size,
        source: payload.source ?? "api",
      });
    },

    async dequeue(workerId) {
      const next = findQueued();
      if (!next) return null;
      next.status = "processing";
      next.workerId = workerId;
      next.attempts += 1;
      console.info("[DR] QUEUE_DEQUEUED", { jobId: next.payload.recordId, workerId });
      return {
        queueEntryId: next.queueEntryId,
        payload: next.payload,
        attempts: next.attempts,
        workerId,
      } satisfies BackupJobQueueItem;
    },

    async ack(recordId, workerId) {
      const entry = entries.get(recordId);
      if (!entry || entry.workerId !== workerId) return;
      entry.status = "completed";
      console.info("[DR] QUEUE_ACK", { jobId: recordId, workerId });
    },

    async fail(recordId, workerId, error, retryable = false) {
      const entry = entries.get(recordId);
      if (!entry || entry.workerId !== workerId) return;
      if (retryable && entry.attempts < entry.maxAttempts) {
        entry.status = "queued";
        entry.workerId = undefined;
        entry.nextRetryAt = Date.now() + 30_000;
        console.info("[DR] QUEUE_RETRY", { jobId: recordId, workerId, error });
        return;
      }
      entry.status = "failed";
      console.info("[DR] QUEUE_FAILED", { jobId: recordId, workerId, error });
    },

    async retry(recordId) {
      const entry = entries.get(recordId);
      if (!entry) return;
      entry.status = "queued";
      entry.attempts = 0;
      entry.workerId = undefined;
      entry.nextRetryAt = undefined;
      console.info("[DR] QUEUE_RETRY", { jobId: recordId, manual: true });
    },

    async cancel(recordId) {
      const entry = entries.get(recordId);
      if (!entry || (entry.status !== "queued" && entry.status !== "processing")) {
        return false;
      }
      entry.status = "cancelled";
      console.info("[DR] QUEUE_CANCELLED", { jobId: recordId });
      return true;
    },

    async peek() {
      const next = findQueued();
      if (!next) return null;
      return {
        queueEntryId: next.queueEntryId,
        payload: next.payload,
        attempts: next.attempts,
        workerId: next.workerId,
      };
    },

    async has(recordId) {
      const entry = entries.get(recordId);
      return Boolean(entry && (entry.status === "queued" || entry.status === "processing"));
    },

    async size() {
      return Array.from(entries.values()).filter(
        (entry) => entry.status === "queued" || entry.status === "processing"
      ).length;
    },

    async list() {
      return Array.from(entries.values())
        .filter((entry) => entry.status === "queued" || entry.status === "processing")
        .map((entry) => entry.payload.recordId);
    },

    async releaseProcessing(recordId, workerId) {
      const entry = entries.get(recordId);
      if (!entry || entry.workerId !== workerId) return;
      entry.status = "queued";
      entry.workerId = undefined;
    },
  };
};
