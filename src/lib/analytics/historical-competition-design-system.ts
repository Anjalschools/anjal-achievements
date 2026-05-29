/**
 * Historical competition intelligence — semantic color tokens.
 */

export const HISTORICAL_COMPETITION_COLORS = {
  participation: {
    bg: "#f8fafc",
    text: "#334155",
    border: "#e2e8f0",
  },
  qualification: {
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
  },
  award: {
    bg: "#fffbeb",
    text: "#b45309",
    border: "#fde68a",
  },
  growth: {
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
  },
  decline: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
  },
  stability: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
  },
  achievement: {
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fcd34d",
  },
} as const;

export type HistoricalSemanticTone =
  | "participation"
  | "qualification"
  | "award"
  | "growth"
  | "decline"
  | "stability"
  | "achievement";

export const metricTone = (metricKey: string): HistoricalSemanticTone => {
  if (metricKey === "participation") return "participation";
  if (metricKey === "nomination" || metricKey === "qualification_rate") return "qualification";
  if (metricKey === "gold" || metricKey === "silver" || metricKey === "bronze" || metricKey.includes("award")) {
    return "award";
  }
  if (metricKey === "acceptance" || metricKey === "pass") return "achievement";
  return "participation";
};
