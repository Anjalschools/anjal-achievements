import "server-only";

export const DR_WORKER_JOB_PHASES = [
  "queued",
  "starting",
  "inventory",
  "exporting",
  "uploading",
  "verifying",
  "completed",
  "failed",
  "cancelled",
] as const;

export type DrWorkerJobPhase = (typeof DR_WORKER_JOB_PHASES)[number];

const WORKER_TRANSITIONS: Record<DrWorkerJobPhase, readonly DrWorkerJobPhase[]> = {
  queued: ["starting", "failed", "cancelled"],
  starting: ["inventory", "exporting", "verifying", "failed", "cancelled"],
  inventory: ["exporting", "failed", "cancelled"],
  exporting: ["uploading", "failed", "cancelled"],
  uploading: ["verifying", "failed", "cancelled"],
  verifying: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export const isDrWorkerJobPhase = (value: string): value is DrWorkerJobPhase =>
  (DR_WORKER_JOB_PHASES as readonly string[]).includes(value);

export const canTransitionDrWorkerPhase = (
  from: DrWorkerJobPhase,
  to: DrWorkerJobPhase
): boolean => WORKER_TRANSITIONS[from].includes(to);

export const mapInternalStageToWorkerPhase = (stage: string): DrWorkerJobPhase => {
  switch (stage) {
    case "queued":
      return "queued";
    case "started":
    case "manifest":
      return "starting";
    case "inventory":
      return "inventory";
    case "object-export":
      return "exporting";
    case "zip":
      return "uploading";
    case "backup-record":
      return "verifying";
    case "complete":
    case "completed":
      return "completed";
    case "failed":
    case "startup_failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "starting";
  }
};

export const normalizeWorkerPhaseForRead = (jobPhase?: string): string | undefined => {
  if (!jobPhase) return jobPhase;
  if (jobPhase === "complete") return "completed";
  if (jobPhase === "started") return "starting";
  if (jobPhase === "object-export") return "exporting";
  if (jobPhase === "backup-record") return "verifying";
  if (jobPhase === "manifest") return "starting";
  if (jobPhase === "zip") return "uploading";
  if (jobPhase === "startup_failed") return "failed";
  return jobPhase;
};
