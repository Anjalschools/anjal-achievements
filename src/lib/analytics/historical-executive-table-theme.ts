/**
 * Executive historical competition table themes.
 */

import { HISTORICAL_COMPETITION_COLORS, metricTone } from "@/lib/analytics/historical-competition-design-system";

export type HistoricalTableDisplayMode = "executive" | "analyst" | "compact" | "printable" | "presentation";

export type ExecutiveTableTheme = {
  id: HistoricalTableDisplayMode;
  headerYearBg: string;
  headerMetricBg: string;
  headerText: string;
  rowLabelBg: string;
  dataBg: string;
  dataAltBg: string;
  totalRowBg: string;
  borderColor: string;
  yearBlockBorder: string;
  fontSize: string;
  cellPadding: string;
  medalEmphasis: boolean;
  qualificationEmphasis: boolean;
  achievementEmphasis: boolean;
};

const baseTheme = (id: HistoricalTableDisplayMode): ExecutiveTableTheme => ({
  id,
  headerYearBg: "#1e3a5f",
  headerMetricBg: "#f1f5f9",
  headerText: "#ffffff",
  rowLabelBg: "#f8fafc",
  dataBg: "#ffffff",
  dataAltBg: "#f8fafc",
  totalRowBg: "#e0e7ff",
  borderColor: "#cbd5e1",
  yearBlockBorder: "#6366f1",
  fontSize: id === "compact" ? "10px" : "11px",
  cellPadding: id === "compact" ? "4px" : "6px",
  medalEmphasis: id !== "compact",
  qualificationEmphasis: true,
  achievementEmphasis: id === "analyst" || id === "presentation",
});

export const EXECUTIVE_TABLE_THEMES: Record<HistoricalTableDisplayMode, ExecutiveTableTheme> = {
  executive: {
    ...baseTheme("executive"),
    headerYearBg: "#312e81",
    medalEmphasis: true,
  },
  analyst: {
    ...baseTheme("analyst"),
    headerYearBg: "#1e293b",
    achievementEmphasis: true,
  },
  compact: baseTheme("compact"),
  printable: {
    ...baseTheme("printable"),
    dataBg: "#fff",
    dataAltBg: "#fafafa",
    borderColor: "#000",
    yearBlockBorder: "#333",
  },
  presentation: {
    ...baseTheme("presentation"),
    headerYearBg: "#4338ca",
    fontSize: "12px",
    cellPadding: "8px",
    medalEmphasis: true,
    qualificationEmphasis: true,
    achievementEmphasis: true,
  },
};

export const resolveExecutiveTableTheme = (
  mode: HistoricalTableDisplayMode = "executive"
): ExecutiveTableTheme => EXECUTIVE_TABLE_THEMES[mode] ?? EXECUTIVE_TABLE_THEMES.executive;

export const metricHeaderStyle = (
  metricKey: string,
  theme: ExecutiveTableTheme
): { background: string; color: string } => {
  const tone = metricTone(metricKey);
  const palette = HISTORICAL_COMPETITION_COLORS[tone];
  if (metricKey === "gold" && theme.medalEmphasis) {
    return { background: HISTORICAL_COMPETITION_COLORS.award.bg, color: HISTORICAL_COMPETITION_COLORS.award.text };
  }
  if ((metricKey === "nomination" || metricKey === "qualification_rate") && theme.qualificationEmphasis) {
    return { background: palette.bg, color: palette.text };
  }
  return { background: theme.headerMetricBg, color: "#334155" };
};

export const cellHighlightStyle = (
  kind: "peak_year" | "trough_year" | "best_rate" | "growth" | "warning" | null
): { background?: string; boxShadow?: string } => {
  if (kind === "peak_year") return { background: HISTORICAL_COMPETITION_COLORS.growth.bg };
  if (kind === "trough_year") return { background: HISTORICAL_COMPETITION_COLORS.decline.bg };
  if (kind === "best_rate") return { background: HISTORICAL_COMPETITION_COLORS.award.bg, boxShadow: "inset 0 0 0 1px #f59e0b" };
  if (kind === "growth") return { background: HISTORICAL_COMPETITION_COLORS.growth.bg };
  if (kind === "warning") return { background: HISTORICAL_COMPETITION_COLORS.decline.bg };
  return {};
};
