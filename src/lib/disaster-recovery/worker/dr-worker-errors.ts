export class DrWorkerLockBusyError extends Error {
  constructor(recordId: string) {
    super(`DR_WORKER_LOCK_BUSY:${recordId}`);
    this.name = "DrWorkerLockBusyError";
  }
}
