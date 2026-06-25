export const DR_MAX_TRACKED_PROMISES = 100;
export const DR_MAX_TRACKED_STREAMS = 200;
export const DR_MAX_TRACKED_TIMERS = 100;
export const DR_MAX_TRACKED_ASYNC_RESOURCES = 500;
export const DR_MAX_HANDLE_DETAIL_LOGS = 12;

export const shouldCaptureDrStacks = (): boolean => process.env.DR_CAPTURE_STACKS === "true";

export const captureDrStack = (): string | undefined => {
  if (!shouldCaptureDrStacks()) return undefined;
  const stack = new Error().stack;
  if (!stack) return undefined;
  return stack.split("\n").slice(0, 6).join("\n");
};

export const truncateDrErrorStack = (error: unknown): string | undefined => {
  if (!shouldCaptureDrStacks()) return undefined;
  if (!(error instanceof Error) || !error.stack) return undefined;
  return error.stack.split("\n").slice(0, 6).join("\n");
};

export { logDrRegistryLimit } from "@/lib/disaster-recovery/dr-diag-guard";
