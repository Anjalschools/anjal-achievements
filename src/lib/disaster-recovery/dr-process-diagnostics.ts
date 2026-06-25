import "server-only";

import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";

let registered = false;

type ProcessEventPayload = {
  event: string;
  pid: number;
  uptime: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  reason?: unknown;
  signal?: string;
  stack?: string;
};

export const buildDrProcessEventPayload = (
  event: string,
  extra?: { reason?: unknown; signal?: string; stack?: string }
): ProcessEventPayload => {
  const memory = readProcessMemorySnapshot();
  return {
    event,
    pid: process.pid,
    uptime: process.uptime(),
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
    reason: extra?.reason,
    signal: extra?.signal,
    stack: extra?.stack,
  };
};

export const logDrProcessEvent = (
  event: string,
  extra?: { reason?: unknown; signal?: string; stack?: string }
): void => {
  console.error("[DR] PROCESS_EVENT", buildDrProcessEventPayload(event, extra));
};

export const registerDrProcessDiagnostics = (): void => {
  if (registered) return;
  registered = true;

  process.on("uncaughtException", (error) => {
    logDrProcessEvent("uncaughtException", {
      reason: error.message,
      stack: truncateDrErrorStack(error),
    });
  });

  process.on("unhandledRejection", (reason) => {
    logDrProcessEvent("unhandledRejection", {
      reason: reason instanceof Error ? reason.message : reason,
      stack: truncateDrErrorStack(reason),
    });
  });

  process.on("warning", (warning) => {
    logDrProcessEvent("warning", {
      reason: warning.message,
      stack: truncateDrErrorStack(warning),
    });
  });

  process.on("exit", (code) => {
    logDrProcessEvent("exit", { reason: code });
  });

  process.on("beforeExit", (code) => {
    logDrProcessEvent("beforeExit", { reason: code });
  });

  process.on("SIGTERM", () => {
    logDrProcessEvent("SIGTERM", { signal: "SIGTERM" });
  });

  process.on("SIGINT", () => {
    logDrProcessEvent("SIGINT", { signal: "SIGINT" });
  });

  console.log("[DR] process diagnostics registered");
};

export const resetDrProcessDiagnosticsRegistration = (): void => {
  registered = false;
};
