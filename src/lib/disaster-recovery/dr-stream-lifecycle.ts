import type { Readable } from "stream";

export const logDrObjectDiag = (event: string, meta: Record<string, unknown> = {}): void => {
  console.info(`[DR] ${event}`, {
    at: new Date().toISOString(),
    ...meta,
  });
};

export const monitorDrStream = (
  stream: Readable,
  context: { objectKey: string; stage: string }
): Readable => {
  const startedAt = Date.now();
  let sawFirstByte = false;

  logDrObjectDiag("Stream created", {
    objectKey: context.objectKey,
    stage: context.stage,
  });

  void import("@/lib/disaster-recovery/dr-verification")
    .then(({ isDrVerificationActive, registerDrTrackedStream }) => {
      if (!isDrVerificationActive()) return;
      registerDrTrackedStream(stream, context);
    })
    .catch(() => undefined);

  void import("@/lib/disaster-recovery/dr-leak-detection")
    .then(({ isDrLeakDetectionActive, registerDrTrackedStreamHandle }) => {
      if (!isDrLeakDetectionActive()) return;
      registerDrTrackedStreamHandle(stream, context);
    })
    .catch(() => undefined);

  stream.on("data", () => {
    if (sawFirstByte) return;
    sawFirstByte = true;
    logDrObjectDiag("Stream first byte", {
      objectKey: context.objectKey,
      stage: context.stage,
      elapsedMs: Date.now() - startedAt,
    });
  });

  stream.on("end", () => {
    logDrObjectDiag("Stream end", {
      objectKey: context.objectKey,
      stage: context.stage,
      elapsedMs: Date.now() - startedAt,
    });
  });

  stream.on("finish", () => {
    logDrObjectDiag("Stream finish", {
      objectKey: context.objectKey,
      stage: context.stage,
      elapsedMs: Date.now() - startedAt,
    });
  });

  stream.on("close", () => {
    logDrObjectDiag("Stream closed", {
      objectKey: context.objectKey,
      stage: context.stage,
      elapsedMs: Date.now() - startedAt,
    });
  });

  stream.on("error", (error) => {
    logDrObjectDiag("Stream error", {
      objectKey: context.objectKey,
      stage: context.stage,
      message: error.message,
      elapsedMs: Date.now() - startedAt,
    });
  });

  return stream;
};

export const destroyDrStream = (stream: Readable | null | undefined, reason?: Error): void => {
  if (!stream || stream.destroyed) return;
  if (reason) {
    logDrObjectDiag("Stream abort", { message: reason.message });
  }
  stream.destroy(reason);
};
