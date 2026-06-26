import "server-only";

import {
  DrWorkerCorruptPayloadError,
  DrWorkerInvalidRecordStateError,
  DrWorkerLockBusyError,
  DrWorkerOrphanQueueError,
} from "@/lib/disaster-recovery/worker/dr-worker-errors";

const DEFAULT_MAX_RETRY_ATTEMPTS = 5;

export type DrFailureCategory = "terminal" | "retryable" | "lock_busy";

export type DrFailureClassification = {
  category: DrFailureCategory;
  retryable: boolean;
  reason: string;
};

export const resolveDrWorkerMaxRetryAttempts = (): number => {
  const raw = process.env.DR_WORKER_MAX_RETRY_ATTEMPTS;
  if (!raw) return DEFAULT_MAX_RETRY_ATTEMPTS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RETRY_ATTEMPTS;
};

export const computeDrRetryBackoffMs = (attempts: number): number => {
  const baseMs = 10_000;
  const maxMs = 300_000;
  const exponent = Math.min(Math.max(attempts - 1, 0), 6);
  return Math.min(maxMs, baseMs * 2 ** exponent);
};

const matchesAny = (haystack: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(haystack));

const RETRYABLE_PATTERNS = [
  /MongoNetworkError/i,
  /MongoServerSelectionError/i,
  /MongoTimeoutError/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /EAI_AGAIN/i,
  /socket hang up/i,
  /ServiceUnavailable/i,
  /InternalServerError/i,
  /503/,
  /502/,
  /504/,
  /429/,
  /Throttling/i,
  /RequestTimeout/i,
  /Cloudinary.*timeout/i,
  /temporary/i,
];

const TERMINAL_PATTERNS = [
  /DR_WORKER_ORPHAN_QUEUE/i,
  /DR_WORKER_CORRUPT_PAYLOAD/i,
  /DR_WORKER_INVALID_RECORD_STATE/i,
  /record_not_found/i,
  /NoSuchKey/i,
  /NotFound/i,
  /404/,
  /InvalidAccessKeyId/i,
  /SignatureDoesNotMatch/i,
  /AccessDenied/i,
  /Invalid credentials/i,
  /Unauthorized/i,
  /401/,
  /403/,
  /missing object/i,
  /object not found/i,
];

export const classifyDrWorkerFailure = (error: unknown): DrFailureClassification => {
  if (error instanceof DrWorkerLockBusyError) {
    if (error.inspection?.rejectionReason === "record_not_found") {
      return { category: "terminal", retryable: false, reason: "orphan_queue_entry" };
    }
    return { category: "lock_busy", retryable: false, reason: "lock_held" };
  }

  if (
    error instanceof DrWorkerOrphanQueueError ||
    error instanceof DrWorkerCorruptPayloadError ||
    error instanceof DrWorkerInvalidRecordStateError ||
    (error instanceof Error && error.name === "DrJobCancelledError")
  ) {
    return { category: "terminal", retryable: false, reason: error.message };
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "Error";
  const combined = `${name}:${message}`;

  if (matchesAny(combined, TERMINAL_PATTERNS)) {
    return { category: "terminal", retryable: false, reason: message };
  }

  if (matchesAny(combined, RETRYABLE_PATTERNS)) {
    return { category: "retryable", retryable: true, reason: message };
  }

  return { category: "terminal", retryable: false, reason: message };
};
