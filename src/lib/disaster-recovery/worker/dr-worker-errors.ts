export class DrWorkerLockBusyError extends Error {
  readonly recordId: string;
  readonly inspection?: import("@/lib/disaster-recovery/worker/dr-worker-lock").DrWorkerLockInspect;

  constructor(
    recordId: string,
    inspection?: import("@/lib/disaster-recovery/worker/dr-worker-lock").DrWorkerLockInspect
  ) {
    super(`DR_WORKER_LOCK_BUSY:${recordId}`);
    this.name = "DrWorkerLockBusyError";
    this.recordId = recordId;
    this.inspection = inspection;
  }
}
