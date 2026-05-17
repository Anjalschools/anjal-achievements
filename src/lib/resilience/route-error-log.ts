import { getMemorySnapshot } from "@/lib/resilience/memory-metrics";
import { recordSlowRoute } from "@/lib/resilience/slow-route-registry";

export type RouteErrorCause =
  | "timeout"
  | "memory_pressure"
  | "mongo_slow"
  | "unhandled_exception"
  | "payload_too_large"
  | "cron_overlap"
  | "unknown";

export type RouteErrorLogParams = {
  path: string;
  durationMs: number;
  correlationId: string;
  cause: RouteErrorCause;
  aggregation?: string;
  payloadBytes?: number;
  documentCount?: number;
  degraded?: boolean;
  message?: string;
};

export const inferRouteErrorCause = (err: unknown, durationMs: number): RouteErrorCause => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("ROUTE_TIMEOUT") || msg.includes("timed out")) return "timeout";
  if (msg.includes("ENOMEM") || msg.includes("heap")) return "memory_pressure";
  if (msg.includes("Mongo") || msg.includes("mongo")) return "mongo_slow";
  if (durationMs >= 25_000) return "timeout";
  return "unhandled_exception";
};

/** Structured production log for 502/500 diagnosis. */
export const logRouteError = (params: RouteErrorLogParams) => {
  const mem = getMemorySnapshot();
  const line = {
    tag: "route-error",
    path: params.path,
    durationMs: params.durationMs,
    memory: mem,
    aggregation: params.aggregation ?? null,
    payloadBytes: params.payloadBytes ?? null,
    documentCount: params.documentCount ?? null,
    correlationId: params.correlationId,
    cause: params.cause,
    degraded: params.degraded ?? false,
    message: params.message ? String(params.message).slice(0, 200) : undefined,
  };
  // eslint-disable-next-line no-console
  console.error("[route-error]", JSON.stringify(line));

  recordSlowRoute({
    path: params.path,
    durationMs: params.durationMs,
    at: new Date().toISOString(),
    correlationId: params.correlationId,
    errorCode: params.cause,
    memoryHeapMb: mem.heapUsedMb,
    payloadBytes: params.payloadBytes,
    degraded: params.degraded,
  });
};

export const payloadByteSize = (body: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
  } catch {
    return 0;
  }
};
