import type {
  BackupJobQueue,
  BackupJobQueueItem,
  BackupJobQueuePayload,
} from "@/lib/disaster-recovery/worker/dr-job-queue-types";
import {
  formatDrWorkerLockBusyError,
  parseDrWorkerLockBusyAttempts,
} from "@/lib/disaster-recovery/worker/dr-worker-lock";
import {
  computeDrRetryBackoffMs,
  resolveDrWorkerMaxRetryAttempts,
} from "@/lib/disaster-recovery/worker/dr-worker-retry-classification";
import { createEmptyDrQueueIntegrityAudit } from "@/lib/disaster-recovery/worker/dr-worker-diagnostics";

type MemoryEntry = {
  queueEntryId: string;
  payload: BackupJobQueuePayload;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  workerId?: string;
  nextRetryAt?: number;
  lastError?: string;
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
      if (!entry || (entry.status !== "processing" && entry.status !== "queued")) return;
      if (entry.workerId && entry.workerId !== workerId) return;

      const maxAttempts = resolveDrWorkerMaxRetryAttempts();
      if (retryable && entry.attempts < maxAttempts) {
        entry.status = "queued";
        entry.workerId = undefined;
        entry.nextRetryAt = Date.now() + computeDrRetryBackoffMs(entry.attempts);
        entry.lastError = error;
        console.info("[DR] QUEUE_RETRY", { jobId: recordId, workerId, error, attempts: entry.attempts });
        return;
      }
      entry.status = "failed";
      entry.workerId = undefined;
      entry.lastError = error;
      console.info("[DR] QUEUE_FAILED", { jobId: recordId, workerId, error, retryable });
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

    async postponeProcessing(recordId, workerId, delayMs, reason) {
      const entry = entries.get(recordId);
      if (!entry || entry.workerId !== workerId || entry.status !== "processing") {
        return 0;
      }
      const lockBusyAttempts = parseDrWorkerLockBusyAttempts(entry.lastError) + 1;
      entry.status = "queued";
      entry.workerId = undefined;
      entry.attempts = Math.max(0, entry.attempts - 1);
      entry.nextRetryAt = Date.now() + delayMs;
      entry.lastError = formatDrWorkerLockBusyError(lockBusyAttempts, reason);
      console.info("[DR] QUEUE_POSTPONED", {
        jobId: recordId,
        workerId,
        delayMs,
        lockBusyAttempts,
        nextRetryAt: entry.nextRetryAt,
        reason,
      });
      return lockBusyAttempts;
    },

    async getLockBusyAttempts(recordId) {
      const entry = entries.get(recordId);
      return parseDrWorkerLockBusyAttempts(entry?.lastError);
    },

    async failTerminal(recordId, workerId, error) {
      const entry = entries.get(recordId);
      if (!entry || (entry.status !== "queued" && entry.status !== "processing")) return;
      entry.status = "failed";
      entry.workerId = undefined;
      entry.lastError = error;
      console.info("[DR] QUEUE_FAILED_TERMINAL", { jobId: recordId, workerId, error });
    },

    async getStatusCounts() {
      const audit = createEmptyDrQueueIntegrityAudit();
      for (const entry of entries.values()) {
        if (entry.status === "queued") audit.queued += 1;
        if (entry.status === "processing") audit.processing += 1;
        if (entry.status === "completed") audit.completed += 1;
        if (entry.status === "failed") audit.failed += 1;
        if (entry.status === "cancelled") audit.cancelled += 1;
      }
      return audit;
    },
  };
};
