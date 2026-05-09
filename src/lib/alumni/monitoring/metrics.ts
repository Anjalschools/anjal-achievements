type LatencySample = { path: string; ms: number; at: number };
type JobSample = { type: string; outcome: "ok" | "failed"; at: number };

const LAT_CAP = 400;
const JOB_CAP = 400;

const latency: LatencySample[] = [];
const jobs: JobSample[] = [];

export const recordApiLatency = (path: string, ms: number): void => {
  latency.push({ path: path.slice(0, 160), ms, at: Date.now() });
  if (latency.length > LAT_CAP) latency.shift();
};

export const recordJobProcessed = (type: string, outcome: "ok" | "failed"): void => {
  jobs.push({ type: type.slice(0, 80), outcome, at: Date.now() });
  if (jobs.length > JOB_CAP) jobs.shift();
};

export const getMetricsSummary = (): {
  latencySamples: number;
  p50MsApprox: number;
  jobsLastHour: { ok: number; failed: number };
} => {
  const since = Date.now() - 3600_000;
  const latRecent = latency.filter((x) => x.at >= since);
  const sorted = [...latRecent].sort((a, b) => a.ms - b.ms);
  const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)].ms : 0;
  const jobRecent = jobs.filter((x) => x.at >= since);
  return {
    latencySamples: latRecent.length,
    p50MsApprox: p50,
    jobsLastHour: {
      ok: jobRecent.filter((j) => j.outcome === "ok").length,
      failed: jobRecent.filter((j) => j.outcome === "failed").length,
    },
  };
};
