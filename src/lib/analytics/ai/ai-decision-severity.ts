import type { AiDecisionSeverity } from "@/lib/analytics/ai/ai-decision-schema";

const RANK: Record<AiDecisionSeverity, number> = {
  INFO: 0,
  WATCH: 1,
  WARNING: 2,
  CRITICAL: 3,
  STRATEGIC_PRIORITY: 4,
};

export const compareAiDecisionSeverity = (a: AiDecisionSeverity, b: AiDecisionSeverity): number =>
  RANK[a] - RANK[b];

export const mapInsightSeverityToDecision = (
  legacy:
    | "info"
    | "warn"
    | "critical"
    | "INFO"
    | "WARNING"
    | "CRITICAL"
    | "OPPORTUNITY"
    | "SUCCESS"
    | "STABILITY"
): AiDecisionSeverity => {
  if (legacy === "critical" || legacy === "CRITICAL") return "CRITICAL";
  if (legacy === "warn" || legacy === "WARNING") return "WARNING";
  if (legacy === "OPPORTUNITY") return "STRATEGIC_PRIORITY";
  if (legacy === "SUCCESS") return "WATCH";
  if (legacy === "STABILITY") return "INFO";
  return "INFO";
};

export const mapRecommendationSeverity = (s: "info" | "moderate" | "high" | "critical"): AiDecisionSeverity => {
  if (s === "critical") return "CRITICAL";
  if (s === "high") return "WARNING";
  if (s === "moderate") return "WATCH";
  return "INFO";
};

export const severityBadgeClass = (severity: AiDecisionSeverity): string => {
  if (severity === "STRATEGIC_PRIORITY") return "bg-indigo-100 text-indigo-950 ring-indigo-300";
  if (severity === "CRITICAL") return "bg-rose-100 text-rose-950 ring-rose-200";
  if (severity === "WARNING") return "bg-amber-100 text-amber-950 ring-amber-200";
  if (severity === "WATCH") return "bg-sky-100 text-sky-900 ring-sky-200";
  return "bg-slate-100 text-slate-800 ring-slate-200";
};

export const softenSeverityForLowConfidence = (
  severity: AiDecisionSeverity,
  exploratory: boolean
): AiDecisionSeverity => {
  if (!exploratory) return severity;
  if (severity === "STRATEGIC_PRIORITY") return "WARNING";
  if (severity === "CRITICAL") return "WARNING";
  if (severity === "WARNING") return "WATCH";
  return severity;
};
