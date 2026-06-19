import type {
  IntelligenceSectionError,
  IntelligenceSectionRecovery,
  IntelligenceSectionStatus,
} from "@/lib/school-improvement/intelligence-diagnostics-types";

export const isEmptyIntelligenceResult = (value: unknown): boolean => {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("totalNodes" in record && Number(record.totalNodes) === 0) return true;
    if ("careerReadiness" in record) {
      return Object.values(record).every((v) => v == null || v === 0 || v === "");
    }
    if ("totalActions" in record && Number(record.totalActions) === 0) {
      return Object.values(record).every((v) => v == null || v === 0);
    }
  }
  return false;
};

export const logIntelligenceSection = (
  tag: string,
  section: string,
  event: "start" | "success" | "failure" | "no_data",
  detail?: { durationMs?: number; message?: string; stack?: string }
) => {
  const base = `${tag}[${section}] ${event}`;
  if (event === "failure") {
    console.error(base, detail?.message || "", detail?.stack || "");
    return;
  }
  if (event === "success" && detail?.durationMs != null && detail.durationMs > 5000) {
    console.warn(`${base} slow ${detail.durationMs}ms`);
    return;
  }
  if (event === "no_data") {
    console.info(`${base} empty dataset ${detail?.durationMs ?? 0}ms`);
    return;
  }
  if (process.env.SCHOOL_IMPROVEMENT_DEBUG === "1") {
    console.info(base, detail?.durationMs != null ? `${detail.durationMs}ms` : "");
  }
};

export type IntelligenceSectionHealth = {
  status: IntelligenceSectionStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  message?: string;
  stack?: string;
  service?: string;
  error?: IntelligenceSectionError;
  recovery?: IntelligenceSectionRecovery;
  domain?: string;
  snapshotFallback?: boolean;
};
