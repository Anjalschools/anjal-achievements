import type { DrWorkerLockInspect } from "@/lib/disaster-recovery/worker/dr-worker-lock";

export class DrWorkerLockBusyError extends Error {
  readonly recordId: string;
  readonly inspection?: DrWorkerLockInspect;

  constructor(recordId: string, inspection?: DrWorkerLockInspect) {
    super(`DR_WORKER_LOCK_BUSY:${recordId}`);
    this.name = "DrWorkerLockBusyError";
    this.recordId = recordId;
    this.inspection = inspection;
  }
}

export class DrWorkerOrphanQueueError extends Error {
  readonly recordId: string;

  constructor(recordId: string, reason = "orphan_queue_entry") {
    super(`DR_WORKER_ORPHAN_QUEUE:${recordId}:${reason}`);
    this.name = "DrWorkerOrphanQueueError";
    this.recordId = recordId;
  }
}

export class DrWorkerCorruptPayloadError extends Error {
  readonly recordId: string;
  readonly reason: string;

  constructor(recordId: string, reason: string) {
    super(`DR_WORKER_CORRUPT_PAYLOAD:${recordId}:${reason}`);
    this.name = "DrWorkerCorruptPayloadError";
    this.recordId = recordId;
    this.reason = reason;
  }
}

export class DrWorkerInvalidRecordStateError extends Error {
  readonly recordId: string;
  readonly reason: string;

  constructor(recordId: string, reason: string) {
    super(`DR_WORKER_INVALID_RECORD_STATE:${recordId}:${reason}`);
    this.name = "DrWorkerInvalidRecordStateError";
    this.recordId = recordId;
    this.reason = reason;
  }
}
