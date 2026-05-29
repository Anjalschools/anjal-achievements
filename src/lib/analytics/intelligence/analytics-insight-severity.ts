import type { InsightSeverity } from "@/lib/analytics/intelligence/analytics-narrative-schema";

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  INFO: 0,
  STABILITY: 1,
  SUCCESS: 2,
  OPPORTUNITY: 3,
  WARNING: 4,
  CRITICAL: 5,
};

export const mapLegacySeverity = (legacy: "info" | "warn" | "critical"): InsightSeverity => {
  if (legacy === "critical") return "CRITICAL";
  if (legacy === "warn") return "WARNING";
  return "INFO";
};

export const compareSeverity = (a: InsightSeverity, b: InsightSeverity): number =>
  SEVERITY_RANK[a] - SEVERITY_RANK[b];

export const severityBadgeClass = (severity: InsightSeverity): string => {
  if (severity === "CRITICAL") return "bg-rose-100 text-rose-900 border-rose-200";
  if (severity === "WARNING") return "bg-amber-100 text-amber-900 border-amber-200";
  if (severity === "OPPORTUNITY") return "bg-teal-100 text-teal-900 border-teal-200";
  if (severity === "SUCCESS") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (severity === "STABILITY") return "bg-violet-100 text-violet-900 border-violet-200";
  return "bg-slate-100 text-slate-800 border-slate-200";
};
