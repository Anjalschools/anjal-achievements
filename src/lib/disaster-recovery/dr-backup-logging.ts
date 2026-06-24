import "server-only";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";

export type DrBackupStage =
  | "manifest"
  | "inventory"
  | "object-export"
  | "zip"
  | "backup-record";

export type DisasterRecoveryErrorPayload = {
  ok: false;
  error: string;
  stage: DrBackupStage | "unknown";
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
};

export class DisasterRecoveryBackupError extends Error {
  readonly stage: DrBackupStage | "unknown";
  readonly details?: Record<string, unknown>;

  constructor(
    stage: DrBackupStage | "unknown",
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown> }
  ) {
    super(message, { cause: options?.cause });
    this.name = "DisasterRecoveryBackupError";
    this.stage = stage;
    this.details = options?.details;
  }

  toPayload(): DisasterRecoveryErrorPayload {
    return {
      ok: false,
      error: this.name,
      stage: this.stage,
      message: this.message,
      stack: this.stack,
      details: this.details,
    };
  }
};

const isDrDebugEnabled = (): boolean => process.env.DR_DEBUG === "1";

export const logDrMemory = (event: string): void => {
  logDr(event, readProcessMemorySnapshot());
};

export const logDr = (event: string, meta?: Record<string, unknown>): void => {
  if (meta && Object.keys(meta).length > 0) {
    console.info(`[DR] ${event}`, meta);
    return;
  }
  console.info(`[DR] ${event}`);
};

export const logDrDebug = (event: string, meta?: Record<string, unknown>): void => {
  if (!isDrDebugEnabled()) return;
  logDr(event, meta);
};

export const toDisasterRecoveryErrorPayload = (error: unknown): DisasterRecoveryErrorPayload => {
  if (error instanceof DisasterRecoveryBackupError) {
    return error.toPayload();
  }

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  return {
    ok: false,
    error: "DisasterRecoveryBackupError",
    stage: "unknown",
    message,
    stack,
  };
};

export const runDrStage = async <T>(
  stage: DrBackupStage,
  fn: () => Promise<T>,
  metaOnDone?: (result: T) => Record<string, unknown>
): Promise<T> => {
  logDr(`${stage}:start`);
  try {
    const result = await fn();
    logDr(`${stage}:done`, metaOnDone ? metaOnDone(result) : undefined);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logDr(`${stage}:failed`, { message, stack, stage });
    if (error instanceof DisasterRecoveryBackupError) {
      throw error;
    }
    throw new DisasterRecoveryBackupError(stage, message, {
      cause: error,
      details: { stack },
    });
  }
};
