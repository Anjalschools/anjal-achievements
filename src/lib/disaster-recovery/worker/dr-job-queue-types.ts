import type { AuditActor } from "@/lib/audit-log-service";
import type { StartDisasterRecoveryJobInput } from "@/lib/disaster-recovery/dr-backup-job-types";
import type { DrQueueIntegrityAudit } from "@/lib/disaster-recovery/worker/dr-worker-diagnostics";

export type BackupJobQueueAuditContext = {
  actor: AuditActor;
};

export type BackupJobQueuePayload = {
  recordId: string;
  input: StartDisasterRecoveryJobInput;
  audit?: BackupJobQueueAuditContext;
  source?: "api" | "cron" | "recovery";
  pruneExpiredOnComplete?: boolean;
};

export type BackupJobQueueItem = {
  queueEntryId: string;
  payload: BackupJobQueuePayload;
  attempts: number;
  workerId?: string;
};

export interface BackupJobQueue {
  enqueue(payload: BackupJobQueuePayload): Promise<void>;
  dequeue(workerId: string): Promise<BackupJobQueueItem | null>;
  ack(recordId: string, workerId: string): Promise<void>;
  fail(recordId: string, workerId: string, error: string, retryable?: boolean): Promise<void>;
  retry(recordId: string): Promise<void>;
  cancel(recordId: string): Promise<boolean>;
  peek(): Promise<BackupJobQueueItem | null>;
  has(recordId: string): Promise<boolean>;
  size(): Promise<number>;
  list(): Promise<string[]>;
  releaseProcessing(recordId: string, workerId: string): Promise<void>;
  postponeProcessing(
    recordId: string,
    workerId: string,
    delayMs: number,
    reason: string
  ): Promise<number>;
  getLockBusyAttempts(recordId: string): Promise<number>;
  failTerminal(recordId: string, workerId: string, error: string): Promise<void>;
  getStatusCounts(): Promise<DrQueueIntegrityAudit>;
}
