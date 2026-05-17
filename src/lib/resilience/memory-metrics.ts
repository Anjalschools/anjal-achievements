/** Node process memory snapshot for route/cron diagnostics (no PII). */

export type MemorySnapshot = {
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
};

const toMb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;

export const getMemorySnapshot = (): MemorySnapshot => {
  const m = process.memoryUsage();
  return {
    heapUsedMb: toMb(m.heapUsed),
    heapTotalMb: toMb(m.heapTotal),
    rssMb: toMb(m.rss),
    externalMb: toMb(m.external),
  };
};

export const isMemoryPressureHigh = (snap?: MemorySnapshot): boolean => {
  const s = snap ?? getMemorySnapshot();
  return s.heapUsedMb > 450 || s.rssMb > 900;
};
