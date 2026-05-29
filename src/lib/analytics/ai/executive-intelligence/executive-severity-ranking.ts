/**
 * Severity hierarchy for executive insights.
 */

export type ExecutiveInsightSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

const RANK: Record<ExecutiveInsightSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export const severityFromTrend = (
  semantic: string,
  cagr: number
): ExecutiveInsightSeverity => {
  if (semantic === "declining" && cagr <= -15) return "critical";
  if (semantic === "declining") return "high";
  if (semantic === "volatile") return "medium";
  if (semantic === "accelerating" && cagr >= 20) return "high";
  if (semantic === "accelerating") return "medium";
  return "info";
};

export const severityFromAlert = (severity: string): ExecutiveInsightSeverity => {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "high";
  return "medium";
};

export const compareSeverity = (
  a: ExecutiveInsightSeverity,
  b: ExecutiveInsightSeverity
): number => RANK[b] - RANK[a];
