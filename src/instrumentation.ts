/**
 * Must stay lightweight: no MongoDB / mongoose / Node native modules pulled into the instrumentation bundle.
 * System stats document bootstrap runs from GET /api/public/home-stats when the row is missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  console.log("[BUILD VERSION]", process.env.RENDER_GIT_COMMIT || "local");
  const { runEnvCheckOnce } = await import("@/lib/env-check");
  runEnvCheckOnce();
  const { registerDrProcessDiagnostics } = await import(
    "@/lib/disaster-recovery/dr-process-diagnostics"
  );
  registerDrProcessDiagnostics();
}

/** Server error hook — lightweight diagnostics for 502 root-cause tracing. */
export async function onRequestError(
  err: Error & { digest?: string },
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logRouteError } = await import("@/lib/resilience/route-error-log");
  const { getMemorySnapshot } = await import("@/lib/resilience/memory-metrics");
  const mem = getMemorySnapshot();
  logRouteError({
    path: context.routePath || request.path,
    durationMs: 0,
    correlationId: err.digest || `inst_${Date.now()}`,
    cause: "unhandled_exception",
    message: `${request.method} ${err.message} heap=${mem.heapUsedMb}MB`,
  });
}
