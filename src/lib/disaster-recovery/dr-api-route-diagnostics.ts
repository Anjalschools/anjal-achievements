import "server-only";

import type { NextResponse } from "next/server";
import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";

export type DrApiRouteContext = {
  route: string;
  method: string;
  jobId?: string;
};

export const logDrApiRequestStart = (context: DrApiRouteContext): void => {
  console.info("[DR] API_REQUEST_START", {
    route: context.route,
    method: context.method,
    jobId: context.jobId,
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage: readProcessMemorySnapshot(),
    timestamp: new Date().toISOString(),
  });
};

export const logDrApiRequestEnd = (
  context: DrApiRouteContext,
  input: { duration: number; statusCode: number }
): void => {
  console.info("[DR] API_REQUEST_END", {
    route: context.route,
    method: context.method,
    jobId: context.jobId,
    duration: input.duration,
    statusCode: input.statusCode,
  });
};

export const logDrApiHandlerFailed = (
  context: DrApiRouteContext,
  error: unknown
): void => {
  const cause = error instanceof Error ? error.cause : undefined;
  console.error("[DR] API_HANDLER_FAILED", {
    route: context.route,
    method: context.method,
    jobId: context.jobId,
    message: error instanceof Error ? error.message : String(error),
    stack: truncateDrErrorStack(error),
    cause,
  });
};

export const runDrApiRoute = async (
  context: DrApiRouteContext,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> => {
  const startedAt = Date.now();
  logDrApiRequestStart(context);
  try {
    const response = await handler();
    logDrApiRequestEnd(context, {
      duration: Date.now() - startedAt,
      statusCode: response.status,
    });
    return response;
  } catch (error) {
    logDrApiHandlerFailed(context, error);
    throw error;
  }
};
