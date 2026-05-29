/**
 * Export runtime isolation telemetry — separate from progressive UI hydration.
 */

const log = (tag: string, payload: Record<string, unknown>): void => {
  // eslint-disable-next-line no-console
  console.info(tag, payload);
};

export type ExecExportRuntimeHandle = {
  correlationId: string;
  startedAt: number;
};

export const startExecExportRuntime = (correlationId: string): ExecExportRuntimeHandle => {
  const handle = { correlationId, startedAt: Date.now() };
  log("[EXEC_EXPORT_RUNTIME_START]", { correlationId, at: new Date().toISOString() });
  return handle;
};

export const endExecExportRuntime = (
  handle: ExecExportRuntimeHandle,
  meta?: { ok?: boolean; rowCount?: number; degraded?: boolean }
): void => {
  log("[EXEC_EXPORT_RUNTIME_END]", {
    correlationId: handle.correlationId,
    durationMs: Date.now() - handle.startedAt,
    ...meta,
  });
};
