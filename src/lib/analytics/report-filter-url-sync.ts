/**
 * Deep-linkable analytics filter URL sync — reports + participation intelligence.
 * Backward compatible with legacy single-value query params.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { mergeExecutiveSnapshotIntoFilter, defaultExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  buildAdminReportSearchParams,
  defaultReportFilterUiState,
  parseAdminReportFiltersFromSearchParams,
  type ReportFilterUiState,
} from "@/lib/analytics/report-filter-params";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
import { deserializeMultiFilterWithLegacy } from "@/lib/analytics/multi-filter-utils";
import type { CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { CI_PDF_PRESET_LABELS } from "@/lib/competition-intelligence-theme";

export type AnalyticsViewScope = "reports" | "participation";

export type AnalyticsTabParam = "general" | "focused" | "studentIntel" | "historical" | "decisions";

export type AnalyticsUrlUiState = {
  tab?: AnalyticsTabParam;
  page?: number;
  focusedPage?: number;
  focusedOutcome?: string;
  focusedPick?: string;
  compareEnabled?: boolean;
  comparePick?: string;
  pdfPreset?: CiPdfExportPreset;
  tableMode?: string;
  sortKey?: string;
  sortAsc?: boolean;
  primaryType?: string;
};

const SKIP_KEYS = new Set(["view"]);

const ALL_TOKENS = new Set(["", "all", "الكل"]);

const hasAnalyticsFilterParams = (sp: URLSearchParams): boolean => {
  const keys = [
    "academicYear",
    "category",
    "categories",
    "level",
    "levels",
    "result",
    "results",
    "outcomes",
    "gender",
    "genders",
    "mawhiba",
    "mawhibaValues",
    "stage",
    "stages",
    "grade",
    "grades",
    "section",
    "sections",
    "status",
    "statuses",
    "certificateStatus",
    "certificateStatuses",
    "activityYears",
    "filterActivityYear",
    "activityYear",
    "achievementName",
    "achievementNames",
    "standardizedTestTypes",
    "fromDate",
    "toDate",
    "domain",
    "classification",
    "organization",
    "primaryType",
    "tab",
    "page",
    "focusedPage",
    "focusedOutcome",
    "focusedPick",
    "compare",
    "comparePick",
    "pdfPreset",
    "tableMode",
    "sortKey",
    "sortAsc",
    "uniqueParticipantsOnly",
    "scoreMin",
    "scoreMax",
  ];
  return keys.some((k) => sp.has(k));
};

/** Normalize legacy singular keys into forms readers already support (non-destructive copy). */
export const normalizeLegacyQueryParams = (sp: URLSearchParams): URLSearchParams => {
  const out = new URLSearchParams(sp.toString());

  const legacyToPlural: Array<[string, string]> = [
    ["achievementName", "achievementNames"],
    ["filterActivityYear", "activityYears"],
    ["activityYear", "activityYears"],
    ["gender", "genders"],
    ["mawhiba", "mawhibaValues"],
    ["stage", "stages"],
    ["grade", "grades"],
    ["section", "sections"],
    ["status", "statuses"],
    ["certificateStatus", "certificateStatuses"],
  ];

  for (const [legacy, plural] of legacyToPlural) {
    const leg = out.get(legacy);
    if (leg && !ALL_TOKENS.has(leg.trim()) && !out.has(plural)) {
      out.set(plural, leg);
    }
  }

  if (!out.has("result") && !out.has("results")) {
    const outcomes = out.get("outcomes");
    if (outcomes) out.set("result", outcomes);
  }

  if (!out.has("category") && out.has("categories")) {
    out.set("category", out.get("categories")!);
  }

  if (!out.has("level") && out.has("levels")) {
    out.set("level", out.get("levels")!);
  }

  return out;
};

export const removeEmptyAnalyticsParams = (sp: URLSearchParams): URLSearchParams => {
  const out = new URLSearchParams();
  sp.forEach((value, key) => {
    if (SKIP_KEYS.has(key)) return;
    const v = String(value).trim();
    if (!v || ALL_TOKENS.has(v)) return;
    out.set(key, v);
  });
  return out;
};

const parsePositiveInt = (raw: string | null, fallback: number, max = 9999): number => {
  const n = parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
};

const parseBoolParam = (raw: string | null): boolean => raw === "1" || raw === "true";

export const deserializeAnalyticsUiFromUrl = (sp: URLSearchParams): AnalyticsUrlUiState => {
  const tabRaw = String(sp.get("tab") || "").trim();
  const tab =
    tabRaw === "focused" ||
    tabRaw === "studentIntel" ||
    tabRaw === "historical" ||
    tabRaw === "decisions" ||
    tabRaw === "general"
      ? tabRaw
      : undefined;

  const pdfRaw = String(sp.get("pdfPreset") || "").trim() as CiPdfExportPreset;
  const pdfPreset = (Object.keys(CI_PDF_PRESET_LABELS) as CiPdfExportPreset[]).includes(pdfRaw)
    ? pdfRaw
    : undefined;

  return {
    tab,
    page: sp.has("page") ? parsePositiveInt(sp.get("page"), 1) : undefined,
    focusedPage: sp.has("focusedPage") ? parsePositiveInt(sp.get("focusedPage"), 1) : undefined,
    focusedOutcome: sp.get("focusedOutcome")?.trim() || undefined,
    focusedPick: sp.get("focusedPick")?.trim() || undefined,
    compareEnabled: sp.has("compare") ? parseBoolParam(sp.get("compare")) : undefined,
    comparePick: sp.get("comparePick")?.trim() || undefined,
    pdfPreset,
    tableMode: sp.get("tableMode")?.trim() || undefined,
    sortKey: sp.get("sortKey")?.trim() || undefined,
    sortAsc: sp.has("sortAsc") ? parseBoolParam(sp.get("sortAsc")) : undefined,
    primaryType: sp.get("primaryType")?.trim() || undefined,
  };
};

export const executiveFilterFromAdminParse = (
  admin: ReturnType<typeof parseAdminReportFiltersFromSearchParams>,
  sp: URLSearchParams
): ExecutiveFilterSnapshot => {
  const base = defaultExecutiveFilterSnapshot();
  if (admin.academicYear) base.academicYear = admin.academicYear;
  if (admin.categories?.length) base.categories = admin.categories;
  if (admin.levels?.length) base.levels = admin.levels;
  if (admin.resultTokens?.length) base.resultTokens = admin.resultTokens;
  if (admin.achievementNames?.length) base.achievementNames = admin.achievementNames;
  if (admin.activityYears?.length) base.activityYears = admin.activityYears.map(String);
  if (admin.genders?.length) base.genders = admin.genders;
  if (admin.mawhibaValues?.length) base.mawhibaValues = admin.mawhibaValues;
  if (admin.stages?.length) base.stages = admin.stages;
  if (admin.grades?.length) base.grades = admin.grades;
  if (admin.statuses?.length) base.statuses = admin.statuses;
  if (admin.certificateStatuses?.length) base.certificateStatuses = admin.certificateStatuses;
  if (admin.standardizedTestTypes?.length) base.standardizedTestTypes = admin.standardizedTestTypes;
  if (admin.fromDate) base.fromDate = admin.fromDate;
  if (admin.toDate) base.toDate = admin.toDate;

  base.gender = String(admin.gender || base.gender);
  base.mawhiba = String(admin.mawhiba || base.mawhiba);
  base.stage = String(admin.stage || base.stage);
  base.grade = String(admin.grade || base.grade);
  base.section = String(sp.get("section") || base.section).trim() || base.section;
  base.status = String(admin.status || base.status);
  base.certificateStatus = String(admin.certificateStatus || base.certificateStatus);

  const sections = deserializeMultiFilterWithLegacy(sp.get("sections"), sp.get("section"));
  if (sections.length) base.sections = sections;

  const domain = String(sp.get("domain") || "").trim();
  if (domain) base.domain = domain;
  const classification = String(sp.get("classification") || "").trim();
  if (classification) base.classification = classification;
  const organization = String(sp.get("organization") || "").trim();
  if (organization) base.organization = organization;

  const primaryType = String(sp.get("primaryType") || "").trim();
  if (primaryType && primaryType !== "all") base.primaryType = primaryType;

  base.genders = deserializeMultiFilterWithLegacy(sp.get("genders"), base.gender);
  base.mawhibaValues = deserializeMultiFilterWithLegacy(sp.get("mawhibaValues"), base.mawhiba);
  base.stages = deserializeMultiFilterWithLegacy(sp.get("stages"), base.stage);
  base.grades = deserializeMultiFilterWithLegacy(sp.get("grades"), base.grade);
  base.sections = deserializeMultiFilterWithLegacy(sp.get("sections"), base.section);
  base.statuses = deserializeMultiFilterWithLegacy(sp.get("statuses"), base.status);
  base.certificateStatuses = deserializeMultiFilterWithLegacy(
    sp.get("certificateStatuses"),
    base.certificateStatus
  );

  return base;
};

export const reportFilterUiFromUrl = (sp: URLSearchParams): ReportFilterUiState => {
  const admin = parseAdminReportFiltersFromSearchParams(sp);
  const base = defaultReportFilterUiState();
  base.academicYear = admin.academicYear || base.academicYear;
  base.categories = admin.categories || [];
  base.achievementNames = admin.achievementNames || [];
  base.activityYears = (admin.activityYears || []).map(String);
  base.genders = admin.genders || [];
  base.mawhibaValues = admin.mawhibaValues || [];
  base.stages = admin.stages || [];
  base.grades = admin.grades || [];
  base.levels = admin.levels || [];
  base.resultTokens = admin.resultTokens || [];
  base.statuses = admin.statuses || [];
  base.certificateStatuses = admin.certificateStatuses || [];
  base.standardizedTestTypes = admin.standardizedTestTypes || [];
  base.fromDate = admin.fromDate || "";
  base.toDate = admin.toDate || "";
  base.uniqueParticipantsOnly = Boolean(admin.uniqueParticipantsOnly);
  if (admin.scoreMin != null) base.scoreMin = admin.scoreMin;
  if (admin.scoreMax != null) base.scoreMax = admin.scoreMax;
  return base;
};

export const deserializeAnalyticsFiltersFromUrl = (
  scope: AnalyticsViewScope,
  raw: URLSearchParams | string
): { filters: ExecutiveFilterSnapshot | ReportFilterUiState; ui: AnalyticsUrlUiState; hasUrlFilters: boolean } => {
  const sp = normalizeLegacyQueryParams(
    typeof raw === "string" ? new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw) : new URLSearchParams(raw.toString())
  );
  const ui = deserializeAnalyticsUiFromUrl(sp);
  const hasUrlFilters = hasAnalyticsFilterParams(sp);

  if (scope === "reports") {
    return { filters: reportFilterUiFromUrl(sp), ui, hasUrlFilters };
  }

  const admin = parseAdminReportFiltersFromSearchParams(sp);
  let filters = executiveFilterFromAdminParse(admin, sp);
  if (ui.primaryType) filters = { ...filters, primaryType: ui.primaryType };
  return { filters, ui, hasUrlFilters };
};

const appendUiToParams = (params: URLSearchParams, ui: AnalyticsUrlUiState | undefined) => {
  if (!ui) return;
  const set = (k: string, v: string | undefined) => {
    if (v) params.set(k, v);
  };
  if (ui.tab && ui.tab !== "general") set("tab", ui.tab);
  if (ui.page && ui.page > 1) set("page", String(ui.page));
  if (ui.focusedPage && ui.focusedPage > 1) set("focusedPage", String(ui.focusedPage));
  set("focusedOutcome", ui.focusedOutcome && ui.focusedOutcome !== "all" ? ui.focusedOutcome : undefined);
  set("focusedPick", ui.focusedPick);
  if (ui.compareEnabled) set("compare", "1");
  set("comparePick", ui.comparePick);
  if (ui.pdfPreset && ui.pdfPreset !== "full") set("pdfPreset", ui.pdfPreset);
  set("tableMode", ui.tableMode && ui.tableMode !== "summary" ? ui.tableMode : undefined);
  set("sortKey", ui.sortKey);
  if (ui.sortAsc) set("sortAsc", "1");
  if (ui.primaryType && ui.primaryType !== "all") set("primaryType", ui.primaryType);
};

export const serializeParticipationFiltersToUrl = (
  filter: ExecutiveFilterSnapshot,
  ui?: AnalyticsUrlUiState
): URLSearchParams => {
  const params = buildParticipationFilterSearchParams(filter);
  params.delete("view");
  appendUiToParams(params, ui);
  return removeEmptyAnalyticsParams(params);
};

export const serializeReportFiltersToUrl = (
  filter: ReportFilterUiState,
  ui?: AnalyticsUrlUiState
): URLSearchParams => {
  const params = buildAdminReportSearchParams(filter as unknown as Record<string, unknown>);
  params.delete("view");
  appendUiToParams(params, ui);
  return removeEmptyAnalyticsParams(params);
};

export const serializeAnalyticsFiltersToUrl = (
  scope: AnalyticsViewScope,
  filter: ExecutiveFilterSnapshot | ReportFilterUiState,
  ui?: AnalyticsUrlUiState
): URLSearchParams => {
  if (scope === "reports") {
    return serializeReportFiltersToUrl(filter as ReportFilterUiState, ui);
  }
  return serializeParticipationFiltersToUrl(filter as ExecutiveFilterSnapshot, ui);
};

export const buildAnalyticsSearchParams = (
  scope: AnalyticsViewScope,
  filter: ExecutiveFilterSnapshot | ReportFilterUiState,
  ui?: AnalyticsUrlUiState
): URLSearchParams => serializeAnalyticsFiltersToUrl(scope, filter, ui);

/** Stable string for deduping router updates (sorted keys). */
export const analyticsSearchParamsCanonicalString = (sp: URLSearchParams): string => {
  const entries = [...sp.entries()].sort(([a], [b]) => a.localeCompare(b));
  const normalized = new URLSearchParams();
  for (const [k, v] of entries) normalized.append(k, v);
  return normalized.toString();
};

export const buildAnalyticsShareUrl = (
  origin: string,
  pathname: string,
  scope: AnalyticsViewScope,
  filter: ExecutiveFilterSnapshot | ReportFilterUiState,
  ui?: AnalyticsUrlUiState
): string => {
  const qs = serializeAnalyticsFiltersToUrl(scope, filter, ui).toString();
  const base = `${origin.replace(/\/$/, "")}${pathname}`;
  return qs ? `${base}?${qs}` : base;
};

export type SyncAnalyticsFiltersWithRouterInput = {
  pathname: string;
  scope: AnalyticsViewScope;
  filter: ExecutiveFilterSnapshot | ReportFilterUiState;
  ui?: AnalyticsUrlUiState;
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

/** Push filter state to the browser URL without scroll reset. */
export const syncAnalyticsFiltersWithRouter = ({
  pathname,
  scope,
  filter,
  ui,
  replace,
}: SyncAnalyticsFiltersWithRouterInput): string => {
  const qs = serializeAnalyticsFiltersToUrl(scope, filter, ui).toString();
  const href = qs ? `${pathname}?${qs}` : pathname;
  replace(href, { scroll: false });
  return qs;
};

export const participationFilterFromExecutiveSnapshot = (f: ExecutiveFilterSnapshot): ExecutiveFilterSnapshot =>
  mergeExecutiveSnapshotIntoFilter({ filter: f });

/** Whether URL query matches serialized filter (avoids redundant replace). */
export const isAnalyticsUrlInSync = (
  scope: AnalyticsViewScope,
  currentQuery: string,
  filter: ExecutiveFilterSnapshot | ReportFilterUiState,
  ui?: AnalyticsUrlUiState
): boolean => {
  const target = analyticsSearchParamsCanonicalString(serializeAnalyticsFiltersToUrl(scope, filter, ui));
  const current = analyticsSearchParamsCanonicalString(
    normalizeLegacyQueryParams(new URLSearchParams(currentQuery.replace(/^\?/, "")))
  );
  return target === current;
};

export { hasAnalyticsFilterParams };
