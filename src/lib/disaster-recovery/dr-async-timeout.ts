const notifyDrPromiseTimeout = (operation: string, objectKey?: string): void => {
  void import("@/lib/disaster-recovery/dr-verification")
    .then(({ isDrVerificationActive, markDrPromiseTimeout }) => {
      if (!isDrVerificationActive()) return;
      markDrPromiseTimeout(objectKey ? `${operation}:${objectKey}` : operation);
    })
    .catch(() => undefined);
};

export class DrOperationTimeoutError extends Error {
  readonly operation: string;
  readonly objectKey?: string;
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number, objectKey?: string) {
    super(
      objectKey
        ? `DR_TIMEOUT:${operation}:${objectKey}:${timeoutMs}ms`
        : `DR_TIMEOUT:${operation}:${timeoutMs}ms`
    );
    this.name = "DrOperationTimeoutError";
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    this.objectKey = objectKey;
  }
}

export const resolveDrTimeoutMs = (envKey: string, fallbackMs: number): number => {
  const raw = process.env[envKey];
  if (!raw) return fallbackMs;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
};

export const DR_OBJECT_DOWNLOAD_TIMEOUT_MS = resolveDrTimeoutMs(
  "DR_OBJECT_DOWNLOAD_TIMEOUT_MS",
  30_000
);
export const DR_STREAM_DRAIN_TIMEOUT_MS = resolveDrTimeoutMs("DR_STREAM_DRAIN_TIMEOUT_MS", 120_000);
export const DR_STREAM_COMPLETED_TIMEOUT_MS = resolveDrTimeoutMs(
  "DR_STREAM_COMPLETED_TIMEOUT_MS",
  180_000
);
export const DR_EXPORT_WATCHDOG_STALL_MS = resolveDrTimeoutMs("DR_EXPORT_WATCHDOG_STALL_MS", 60_000);
export const DR_ARCHIVE_FINALIZE_TIMEOUT_MS = resolveDrTimeoutMs(
  "DR_ARCHIVE_FINALIZE_TIMEOUT_MS",
  300_000
);
export const DR_UPLOAD_COMPLETE_TIMEOUT_MS = resolveDrTimeoutMs(
  "DR_UPLOAD_COMPLETE_TIMEOUT_MS",
  600_000
);

export const withDrTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
  meta?: { objectKey?: string }
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (): void => {
      if (settled) return;
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    timer = setTimeout(() => {
      settle();
      notifyDrPromiseTimeout(operation, meta?.objectKey);
      reject(new DrOperationTimeoutError(operation, timeoutMs, meta?.objectKey));
    }, timeoutMs);

    void promise.then(
      (value) => {
        if (settled) return;
        settle();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settle();
        reject(error);
      }
    );
  });

export const withDrAbortTimeout = async <T>(
  operation: string,
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
  meta?: { objectKey?: string }
): Promise<T> => {
  const controller = new AbortController();
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const settle = (): void => {
    if (settled) return;
    settled = true;
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      settle();
      controller.abort();
      notifyDrPromiseTimeout(operation, meta?.objectKey);
      reject(new DrOperationTimeoutError(operation, timeoutMs, meta?.objectKey));
    }, timeoutMs);

    void fn(controller.signal).then(
      (value) => {
        if (settled) return;
        settle();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settle();
        reject(error);
      }
    );
  });
};
