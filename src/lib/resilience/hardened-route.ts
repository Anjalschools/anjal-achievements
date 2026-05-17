import { NextRequest, NextResponse } from "next/server";
import { createCorrelationId } from "@/lib/competition-intelligence-debug";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  DEFAULT_ROUTE_TIMEOUT_MS,
  QueryTimeoutError,
  withTimeout,
} from "@/lib/resilience/query-safety";
import {
  inferRouteErrorCause,
  logRouteError,
  payloadByteSize,
} from "@/lib/resilience/route-error-log";
import { isMemoryPressureHigh } from "@/lib/resilience/memory-metrics";
import { recordSlowRoute } from "@/lib/resilience/slow-route-registry";

export type HardenedRouteContext = {
  request: NextRequest;
  path: string;
  correlationId: string;
  startMs: number;
};

export type HardenedRouteOptions<T> = {
  path: string;
  timeoutMs?: number;
  aggregation?: string;
  handler: (ctx: HardenedRouteContext) => Promise<NextResponse | T>;
  /** Return JSON body on failure instead of throwing (graceful degradation). */
  fallback?: (
    ctx: HardenedRouteContext,
    reason: { cause: string; message: string }
  ) => Promise<NextResponse | T>;
  /** If handler returns plain object, wrap in NextResponse.json */
  wrapJson?: boolean;
};

export const runHardenedRoute = async <T extends Record<string, unknown>>(
  request: NextRequest,
  options: HardenedRouteOptions<T>
): Promise<NextResponse> => {
  const correlationId =
    request.headers.get("x-correlation-id")?.trim() || createCorrelationId();
  const startMs = Date.now();
  const path = options.path;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ROUTE_TIMEOUT_MS;
  const ctx: HardenedRouteContext = { request, path, correlationId, startMs };

  const respond = (body: NextResponse | T): NextResponse => {
    if (body instanceof NextResponse) {
      body.headers.set("X-Correlation-Id", correlationId);
      return body;
    }
    const res = NextResponse.json(body);
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  };

  try {
    const out = await withTimeout(path, timeoutMs, async () => options.handler(ctx));
    const durationMs = Date.now() - startMs;
    if (durationMs >= 5000) {
      recordSlowRoute({
        path,
        durationMs,
        at: new Date().toISOString(),
        correlationId,
        errorCode: isMemoryPressureHigh() ? "memory_pressure" : "slow_ok",
        degraded: false,
      });
    }
    return respond(out);
  } catch (e) {
    const durationMs = Date.now() - startMs;
    const cause = inferRouteErrorCause(e, durationMs);
    const message = e instanceof Error ? e.message : "Error";
    logRouteError({
      path,
      durationMs,
      correlationId,
      cause,
      aggregation: options.aggregation,
      message,
      degraded: Boolean(options.fallback),
    });

    if (options.fallback) {
      try {
        const fb = await options.fallback(ctx, { cause, message });
        const res = respond(fb);
        res.headers.set("X-Degraded", "1");
        return res;
      } catch (fbErr) {
        logRouteError({
          path,
          durationMs: Date.now() - startMs,
          correlationId,
          cause: "unhandled_exception",
          message: fbErr instanceof Error ? fbErr.message : "fallback_failed",
        });
      }
    }

    const status = e instanceof QueryTimeoutError ? 504 : 500;
    const res = jsonInternalServerError(e, {
      status,
      merge: {
        correlationId,
        degraded: false,
        cause,
      },
    });
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  }
};

export { payloadByteSize };
