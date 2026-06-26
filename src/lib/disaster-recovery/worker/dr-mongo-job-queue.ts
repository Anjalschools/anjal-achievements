import "server-only";

import connectDB from "@/lib/mongodb";
import DrBackupQueueEntry, {
  type DrBackupQueuePayloadDocument,
} from "@/models/DrBackupQueueEntry";
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

const serializeQueuePayload = (payload: BackupJobQueuePayload): DrBackupQueuePayloadDocument => ({
  recordId: payload.recordId,
  input: {
    moduleId: payload.input.moduleId,
    storageProvider: payload.input.storageProvider,
    createdByUserId: payload.input.createdByUserId,
    includeObjects: payload.input.includeObjects,
    retentionTier: payload.input.retentionTier,
    note: payload.input.note,
  },
  audit: payload.audit
    ? {
        actor: {
          id: payload.audit.actor.id ? String(payload.audit.actor.id) : undefined,
          name: payload.audit.actor.name,
          email: payload.audit.actor.email,
          role: payload.audit.actor.role,
        },
      }
    : undefined,
  source: payload.source,
  pruneExpiredOnComplete: payload.pruneExpiredOnComplete,
});

const toQueuePayload = (document: DrBackupQueuePayloadDocument): BackupJobQueuePayload => ({
  recordId: document.recordId,
  input: {
    moduleId: document.input.moduleId as BackupJobQueuePayload["input"]["moduleId"],
    storageProvider:
      document.input.storageProvider as BackupJobQueuePayload["input"]["storageProvider"],
    createdByUserId: document.input.createdByUserId,
    includeObjects: document.input.includeObjects,
    retentionTier: document.input.retentionTier as BackupJobQueuePayload["input"]["retentionTier"],
    note: document.input.note,
  },
  audit: document.audit
    ? {
        actor: {
          name: document.audit.actor.name,
          email: document.audit.actor.email,
          role: document.audit.actor.role,
        },
      }
    : undefined,
  source: document.source,
  pruneExpiredOnComplete: document.pruneExpiredOnComplete,
});

const toQueueItem = (row: {
  _id: unknown;
  payload: BackupJobQueuePayload;
  attempts: number;
  workerId?: string;
}): BackupJobQueueItem => ({
  queueEntryId: String(row._id),
  payload: row.payload,
  attempts: row.attempts,
  workerId: row.workerId,
});

export const createMongoBackupJobQueue = (): BackupJobQueue => ({
  async enqueue(payload) {
    await connectDB();
    const storedPayload = serializeQueuePayload(payload);
    const existing = await DrBackupQueueEntry.findOne({ recordId: payload.recordId });
    if (existing && existing.status !== "failed" && existing.status !== "cancelled") {
      return;
    }

    if (existing) {
      await DrBackupQueueEntry.findOneAndUpdate(
        { recordId: payload.recordId },
        {
          status: "queued",
          payload: storedPayload,
          attempts: 0,
          workerId: undefined,
          dequeuedAt: undefined,
          ackedAt: undefined,
          failedAt: undefined,
          cancelledAt: undefined,
          lastError: undefined,
          nextRetryAt: undefined,
          enqueuedAt: new Date(),
        }
      );
    } else {
      await DrBackupQueueEntry.create({
        recordId: payload.recordId,
        status: "queued",
        payload: storedPayload,
        attempts: 0,
        maxAttempts: 1,
        enqueuedAt: new Date(),
      });
    }

    const backlog = await DrBackupQueueEntry.countDocuments({
      status: { $in: ["queued", "processing"] },
    });
    console.info("[DR] QUEUE_PERSISTED", {
      jobId: payload.recordId,
      source: payload.source ?? "api",
      backlog,
    });
    console.info("[DR] QUEUE_ENQUEUED", {
      jobId: payload.recordId,
      queueSize: backlog,
      source: payload.source ?? "api",
    });
  },

  async dequeue(workerId) {
    await connectDB();
    const now = new Date();
    const row = await DrBackupQueueEntry.findOneAndUpdate(
      {
        status: "queued",
        $or: [{ nextRetryAt: { $exists: false } }, { nextRetryAt: null }, { nextRetryAt: { $lte: now } }],
      },
      {
        status: "processing",
        workerId,
        dequeuedAt: now,
        $inc: { attempts: 1 },
      },
      { sort: { enqueuedAt: 1 }, new: true }
    ).lean();

    if (!row) return null;

    const backlog = await DrBackupQueueEntry.countDocuments({
      status: { $in: ["queued", "processing"] },
    });
    console.info("[DR] QUEUE_DEQUEUED", {
      jobId: String(row.recordId),
      workerId,
      queueSize: backlog,
      attempts: row.attempts,
    });

    return toQueueItem({
      _id: row._id,
      payload: toQueuePayload(row.payload as DrBackupQueuePayloadDocument),
      attempts: row.attempts,
      workerId: row.workerId,
    });
  },

  async ack(recordId, workerId) {
    await connectDB();
    await DrBackupQueueEntry.findOneAndUpdate(
      { recordId, workerId, status: "processing" },
      { status: "completed", ackedAt: new Date() }
    );
    console.info("[DR] QUEUE_ACK", { jobId: recordId, workerId });
  },

  async fail(recordId, workerId, error, retryable = false) {
    await connectDB();
    const row =
      (await DrBackupQueueEntry.findOne({ recordId, workerId, status: "processing" }).lean()) ??
      (await DrBackupQueueEntry.findOne({ recordId, status: "processing" }).lean());
    if (!row) return;

    const maxAttempts = resolveDrWorkerMaxRetryAttempts();
    const shouldRetry = retryable && row.attempts < maxAttempts;
    if (shouldRetry) {
      const nextRetryAt = new Date(Date.now() + computeDrRetryBackoffMs(row.attempts));
      await DrBackupQueueEntry.findOneAndUpdate(
        { _id: row._id },
        {
          status: "queued",
          lastError: error,
          nextRetryAt,
          workerId: undefined,
          dequeuedAt: undefined,
        }
      );
      console.info("[DR] QUEUE_RETRY", {
        jobId: recordId,
        workerId,
        error,
        nextRetryAt,
        attempts: row.attempts,
        maxAttempts,
      });
      return;
    }

    await DrBackupQueueEntry.findOneAndUpdate(
      { _id: row._id },
      { status: "failed", failedAt: new Date(), lastError: error, workerId: undefined, dequeuedAt: undefined }
    );
    console.info("[DR] QUEUE_FAILED", { jobId: recordId, workerId, error, retryable });
  },

  async retry(recordId) {
    await connectDB();
    await DrBackupQueueEntry.findOneAndUpdate(
      { recordId, status: { $in: ["failed", "processing"] } },
      {
        status: "queued",
        attempts: 0,
        workerId: undefined,
        dequeuedAt: undefined,
        failedAt: undefined,
        lastError: undefined,
        nextRetryAt: undefined,
        enqueuedAt: new Date(),
      }
    );
    console.info("[DR] QUEUE_RETRY", { jobId: recordId, manual: true });
  },

  async cancel(recordId) {
    await connectDB();
    const result = await DrBackupQueueEntry.findOneAndUpdate(
      { recordId, status: { $in: ["queued", "processing"] } },
      { status: "cancelled", cancelledAt: new Date() },
      { new: true }
    );
    if (result) {
      console.info("[DR] QUEUE_CANCELLED", { jobId: recordId });
    }
    return Boolean(result);
  },

  async peek() {
    await connectDB();
    const row = await DrBackupQueueEntry.findOne({
      status: "queued",
      $or: [{ nextRetryAt: { $exists: false } }, { nextRetryAt: null }, { nextRetryAt: { $lte: new Date() } }],
    })
      .sort({ enqueuedAt: 1 })
      .lean();
    if (!row) return null;
    return toQueueItem({
      _id: row._id,
      payload: toQueuePayload(row.payload as DrBackupQueuePayloadDocument),
      attempts: row.attempts,
      workerId: row.workerId,
    });
  },

  async has(recordId) {
    await connectDB();
    const row = await DrBackupQueueEntry.findOne({
      recordId,
      status: { $in: ["queued", "processing"] },
    })
      .select("_id")
      .lean();
    return Boolean(row);
  },

  async size() {
    await connectDB();
    return DrBackupQueueEntry.countDocuments({ status: { $in: ["queued", "processing"] } });
  },

  async list() {
    await connectDB();
    const rows = await DrBackupQueueEntry.find({ status: { $in: ["queued", "processing"] } })
      .sort({ enqueuedAt: 1 })
      .select("recordId")
      .lean();
    return rows.map((row) => String(row.recordId));
  },

  async releaseProcessing(recordId, workerId) {
    await connectDB();
    await DrBackupQueueEntry.findOneAndUpdate(
      { recordId, workerId, status: "processing" },
      {
        status: "queued",
        workerId: undefined,
        dequeuedAt: undefined,
      }
    );
  },

  async postponeProcessing(recordId, workerId, delayMs, reason) {
    await connectDB();
    const row = await DrBackupQueueEntry.findOne({
      recordId,
      workerId,
      status: "processing",
    }).lean();
    if (!row) return 0;

    const lockBusyAttempts = parseDrWorkerLockBusyAttempts(row.lastError) + 1;
    const nextRetryAt = new Date(Date.now() + delayMs);
    await DrBackupQueueEntry.findOneAndUpdate(
      { recordId, workerId, status: "processing" },
      {
        status: "queued",
        workerId: undefined,
        dequeuedAt: undefined,
        nextRetryAt,
        lastError: formatDrWorkerLockBusyError(lockBusyAttempts, reason),
        $inc: { attempts: -1 },
      }
    );
    console.info("[DR] QUEUE_POSTPONED", {
      jobId: recordId,
      workerId,
      delayMs,
      lockBusyAttempts,
      nextRetryAt,
      reason,
    });
    return lockBusyAttempts;
  },

  async getLockBusyAttempts(recordId) {
    await connectDB();
    const row = await DrBackupQueueEntry.findOne({ recordId }).select("lastError").lean();
    return parseDrWorkerLockBusyAttempts(row?.lastError);
  },

  async failTerminal(recordId, workerId, error) {
    await connectDB();
    await DrBackupQueueEntry.findOneAndUpdate(
      {
        recordId,
        status: { $in: ["queued", "processing"] },
        $or: [{ workerId }, { workerId: { $exists: false } }, { workerId: null }],
      },
      {
        status: "failed",
        failedAt: new Date(),
        lastError: error,
        workerId: undefined,
        dequeuedAt: undefined,
      }
    );
    console.info("[DR] QUEUE_FAILED_TERMINAL", { jobId: recordId, workerId, error });
  },

  async getStatusCounts() {
    await connectDB();
    const audit = createEmptyDrQueueIntegrityAudit();
    const [queued, processing, completed, failed, cancelled] = await Promise.all([
      DrBackupQueueEntry.countDocuments({ status: "queued" }),
      DrBackupQueueEntry.countDocuments({ status: "processing" }),
      DrBackupQueueEntry.countDocuments({ status: "completed" }),
      DrBackupQueueEntry.countDocuments({ status: "failed" }),
      DrBackupQueueEntry.countDocuments({ status: "cancelled" }),
    ]);
    audit.queued = queued;
    audit.processing = processing;
    audit.completed = completed;
    audit.failed = failed;
    audit.cancelled = cancelled;
    return audit;
  },
});
