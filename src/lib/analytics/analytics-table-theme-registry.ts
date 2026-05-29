/**
 * Professional educational table themes — reference spreadsheet styling.
 */

export type AnalyticsTableThemeId =
  | "olympiad"
  | "competition"
  | "talent"
  | "testing"
  | "program"
  | "executive";

export type AnalyticsTableTheme = {
  id: AnalyticsTableThemeId;
  headerYearBg: string;
  headerMetricBg: string;
  rowLabelBg: string;
  totalRowBg: string;
  dataBg: string;
  dataAltBg: string;
  borderColor: string;
  headerText: string;
  bodyText: string;
};

export const ANALYTICS_TABLE_THEMES: Record<AnalyticsTableThemeId, AnalyticsTableTheme> = {
  olympiad: {
    id: "olympiad",
    headerYearBg: "#FFF2CC",
    headerMetricBg: "#D9EAD3",
    rowLabelBg: "#FFF2CC",
    totalRowBg: "#F4CCCC",
    dataBg: "#FFFFFF",
    dataAltBg: "#E8F4FC",
    borderColor: "#1a1a1a",
    headerText: "#1a1a1a",
    bodyText: "#1a1a1a",
  },
  competition: {
    id: "competition",
    headerYearBg: "#CFE2F3",
    headerMetricBg: "#FCE5CD",
    rowLabelBg: "#FCE5CD",
    totalRowBg: "#F4CCCC",
    dataBg: "#F8FBFF",
    dataAltBg: "#E8F4FC",
    borderColor: "#1a1a1a",
    headerText: "#1a1a1a",
    bodyText: "#1a1a1a",
  },
  talent: {
    id: "talent",
    headerYearBg: "#B4C7E7",
    headerMetricBg: "#D9EAD3",
    rowLabelBg: "#FFF2CC",
    totalRowBg: "#F4CCCC",
    dataBg: "#E8F0FA",
    dataAltBg: "#D0E2F3",
    borderColor: "#1a1a1a",
    headerText: "#1a1a1a",
    bodyText: "#1a1a1a",
  },
  testing: {
    id: "testing",
    headerYearBg: "#D9D9D9",
    headerMetricBg: "#E2EFDA",
    rowLabelBg: "#FFF2CC",
    totalRowBg: "#FCE5CD",
    dataBg: "#FFFFFF",
    dataAltBg: "#F3F3F3",
    borderColor: "#333333",
    headerText: "#1a1a1a",
    bodyText: "#1a1a1a",
  },
  program: {
    id: "program",
    headerYearBg: "#D9EAD3",
    headerMetricBg: "#EFEFEF",
    rowLabelBg: "#FFF2CC",
    totalRowBg: "#F4CCCC",
    dataBg: "#FFFFFF",
    dataAltBg: "#F5F5F5",
    borderColor: "#1a1a1a",
    headerText: "#1a1a1a",
    bodyText: "#1a1a1a",
  },
  executive: {
    id: "executive",
    headerYearBg: "#4F46E5",
    headerMetricBg: "#6366F1",
    rowLabelBg: "#EEF2FF",
    totalRowBg: "#C7D2FE",
    dataBg: "#FFFFFF",
    dataAltBg: "#F8FAFC",
    borderColor: "#334155",
    headerText: "#FFFFFF",
    bodyText: "#0f172a",
  },
};

export const resolveTableTheme = (id: AnalyticsTableThemeId): AnalyticsTableTheme =>
  ANALYTICS_TABLE_THEMES[id];
