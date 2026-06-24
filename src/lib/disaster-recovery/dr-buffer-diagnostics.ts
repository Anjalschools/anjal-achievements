import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";

export const logDrBufferFallbackEnter = (context: string): void => {
  const memory = readProcessMemorySnapshot();
  console.warn("[DR] BUFFER_FALLBACK_ENTER", { context, ...memory });
};

export const logDrBufferFallbackExit = (context: string, byteLength?: number): void => {
  const memory = readProcessMemorySnapshot();
  console.warn("[DR] BUFFER_FALLBACK_EXIT", { context, byteLength, ...memory });
};
