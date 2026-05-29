import type { CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { CI_STORAGE_KEYS } from "@/lib/competition-intelligence-theme";
import { competitionIntelDebug, competitionIntelWarn } from "@/lib/competition-intelligence-diagnostics";

const SAVED_VIEWS_KEY = "anjal-ci-saved-views-v1";
const MAX_SAVED = 12;

/** Serializable filter slice for executive restore (matches participation report filter shape). */
export type ExecutiveFilterSnapshot = {
  academicYear: string;
  /** @deprecated prefer `genders[]` */
  gender: string;
  /** @deprecated prefer `mawhibaValues[]` */
  mawhiba: string;
  /** @deprecated prefer `stages[]` */
  stage: string;
  /** @deprecated prefer `grades[]` */
  grade: string;
  /** @deprecated prefer `sections[]` */
  section: string;
  categories: string[];
  primaryType: string;
  levels: string[];
  resultTokens: string[];
  /** @deprecated prefer `statuses[]` */
  status: string;
  /** @deprecated prefer `certificateStatuses[]` */
  certificateStatus: string;
  fromDate: string;
  toDate: string;
  domain: string;
  classification: string;
  organization: string;
  activityYears: string[];
  achievementNames: string[];
  genders: string[];
  mawhibaValues: string[];
  stages: string[];
  grades: string[];
  sections: string[];
  statuses: string[];
  certificateStatuses: string[];
  standardizedTestTypes: string[];
};

export type ExecutiveUiSnapshot = {
  v: 1;
  academicYear?: string;
  focusedOutcome?: string;
  focusedPick?: string;
  comparePick?: string;
  compareEnabled?: boolean;
  pdfPreset?: CiPdfExportPreset;
  /** detailMode key stores executive | detailed */
  viewDensity?: "executive" | "detailed";
  filter?: Partial<ExecutiveFilterSnapshot>;
  /** Raw JSON blob for {@link CI_STORAGE_KEYS.collapse} (section open/close). */
  collapseJson?: string | null;
};

export const defaultExecutiveFilterSnapshot = (): ExecutiveFilterSnapshot => ({
  academicYear: "2025-2026م",
  gender: "all",
  mawhiba: "all",
  stage: "all",
  grade: "all",
  section: "all",
  categories: [],
  primaryType: "all",
  levels: [],
  resultTokens: [],
  status: "all",
  certificateStatus: "all",
  fromDate: "",
  toDate: "",
  domain: "",
  classification: "",
  organization: "",
  activityYears: [],
  achievementNames: [],
  genders: [],
  mawhibaValues: [],
  stages: [],
  grades: [],
  sections: [],
  statuses: [],
  certificateStatuses: [],
  standardizedTestTypes: [],
});

const mergeMultiFromLegacy = (
  plural: string[] | undefined,
  legacy: string | undefined,
  allToken = "all"
): string[] => {
  const base = Array.isArray(plural) ? plural.filter(Boolean) : [];
  const leg = String(legacy || "").trim();
  if (base.length > 0) return base;
  if (leg && leg !== allToken) return [leg];
  return [];
};

export const mergeExecutiveSnapshotIntoFilter = (snap: Partial<ExecutiveUiSnapshot>): ExecutiveFilterSnapshot => {
  const base = defaultExecutiveFilterSnapshot();
  const f = snap.filter;
  if (f && typeof f === "object") {
    const assignStr = (k: keyof ExecutiveFilterSnapshot) => {
      const v = f[k];
      if (typeof v === "string") (base as Record<string, unknown>)[k as string] = v;
    };
    assignStr("academicYear");
    assignStr("gender");
    assignStr("mawhiba");
    assignStr("stage");
    assignStr("grade");
    assignStr("section");
    assignStr("primaryType");
    assignStr("status");
    assignStr("certificateStatus");
    assignStr("fromDate");
    assignStr("toDate");
    assignStr("domain");
    assignStr("classification");
    assignStr("organization");
    if (Array.isArray(f.categories)) base.categories = f.categories.filter((x) => typeof x === "string");
    if (Array.isArray(f.levels)) base.levels = f.levels.filter((x) => typeof x === "string");
    if (Array.isArray(f.resultTokens)) base.resultTokens = f.resultTokens.filter((x) => typeof x === "string");
    if (Array.isArray(f.activityYears)) base.activityYears = f.activityYears.map(String);
    if (Array.isArray(f.achievementNames)) base.achievementNames = f.achievementNames.filter((x) => typeof x === "string");
    if (Array.isArray(f.genders)) base.genders = f.genders.filter((x) => typeof x === "string");
    if (Array.isArray(f.mawhibaValues)) base.mawhibaValues = f.mawhibaValues.filter((x) => typeof x === "string");
    if (Array.isArray(f.stages)) base.stages = f.stages.filter((x) => typeof x === "string");
    if (Array.isArray(f.grades)) base.grades = f.grades.filter((x) => typeof x === "string");
    if (Array.isArray(f.sections)) base.sections = f.sections.filter((x) => typeof x === "string");
    if (Array.isArray(f.statuses)) base.statuses = f.statuses.filter((x) => typeof x === "string");
    if (Array.isArray(f.certificateStatuses)) base.certificateStatuses = f.certificateStatuses.filter((x) => typeof x === "string");
    if (Array.isArray(f.standardizedTestTypes)) base.standardizedTestTypes = f.standardizedTestTypes.filter((x) => typeof x === "string");
  }
  base.genders = mergeMultiFromLegacy(base.genders, base.gender);
  base.mawhibaValues = mergeMultiFromLegacy(base.mawhibaValues, base.mawhiba);
  base.stages = mergeMultiFromLegacy(base.stages, base.stage);
  base.grades = mergeMultiFromLegacy(base.grades, base.grade);
  base.sections = mergeMultiFromLegacy(base.sections, base.section);
  base.statuses = mergeMultiFromLegacy(base.statuses, base.status);
  base.certificateStatuses = mergeMultiFromLegacy(base.certificateStatuses, base.certificateStatus);
  if (typeof snap.academicYear === "string" && snap.academicYear.trim() && !f?.academicYear) {
    base.academicYear = snap.academicYear;
  }
  return base;
};

/** Restore collapsible + density before the focused panel reads localStorage. */
export const hydrateLocalStoragePanelsFromSnapshot = (snap: Partial<ExecutiveUiSnapshot>) => {
  if (typeof window === "undefined") return;
  if (typeof snap.collapseJson === "string" && snap.collapseJson.length > 0) {
    try {
      localStorage.setItem(CI_STORAGE_KEYS.collapse, snap.collapseJson);
    } catch {
      /* ignore */
    }
  }
  if (snap.viewDensity === "executive" || snap.viewDensity === "detailed") {
    try {
      localStorage.setItem(CI_STORAGE_KEYS.detailMode, snap.viewDensity);
    } catch {
      /* ignore */
    }
  }
};

export const captureExecutiveAuxLocalState = (): {
  collapseJson?: string;
  viewDensity?: "executive" | "detailed";
} => {
  if (typeof window === "undefined") return {};
  try {
    const collapseJson = localStorage.getItem(CI_STORAGE_KEYS.collapse) ?? undefined;
    const dm = localStorage.getItem(CI_STORAGE_KEYS.detailMode);
    const viewDensity = dm === "executive" || dm === "detailed" ? dm : undefined;
    return { collapseJson: collapseJson ?? undefined, viewDensity };
  } catch {
    return {};
  }
};

export const cloneExecutiveFilterSnapshot = (f: ExecutiveFilterSnapshot): ExecutiveFilterSnapshot => ({
  ...f,
  categories: [...f.categories],
  levels: [...f.levels],
  resultTokens: [...f.resultTokens],
  activityYears: [...f.activityYears],
  achievementNames: [...f.achievementNames],
  genders: [...f.genders],
  mawhibaValues: [...f.mawhibaValues],
  stages: [...f.stages],
  grades: [...f.grades],
  sections: [...f.sections],
  statuses: [...f.statuses],
  certificateStatuses: [...f.certificateStatuses],
  standardizedTestTypes: [...f.standardizedTestTypes],
});

export type SavedExecutiveView = {
  id: string;
  nameAr: string;
  nameEn: string;
  snapshot: ExecutiveUiSnapshot;
};

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    competitionIntelWarn("Corrupt localStorage JSON, resetting slice", raw.slice(0, 80));
    return fallback;
  }
};

export const readExecutiveSnapshot = (): Partial<ExecutiveUiSnapshot> => {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(CI_STORAGE_KEYS.execSnapshot);
  if (!raw) return {};
  const j = safeParse<ExecutiveUiSnapshot | { v?: number }>(raw, {});
  if (!j || typeof j !== "object" || (j as ExecutiveUiSnapshot).v !== 1) return {};
  return j as ExecutiveUiSnapshot;
};

export const writeExecutiveSnapshot = (partial: Partial<ExecutiveUiSnapshot>) => {
  if (typeof window === "undefined") return;
  try {
    const prev = readExecutiveSnapshot();
    const next: ExecutiveUiSnapshot = { v: 1, ...prev, ...partial };
    localStorage.setItem(CI_STORAGE_KEYS.execSnapshot, JSON.stringify(next));
    competitionIntelDebug("exec snapshot saved", Object.keys(partial));
  } catch (e) {
    competitionIntelWarn("Failed to persist executive snapshot", e);
  }
};

export const readSavedExecutiveViews = (): SavedExecutiveView[] => {
  if (typeof window === "undefined") return [];
  return safeParse<SavedExecutiveView[]>(localStorage.getItem(SAVED_VIEWS_KEY), []);
};

export const writeSavedExecutiveViews = (views: SavedExecutiveView[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.slice(0, MAX_SAVED)));
  } catch (e) {
    competitionIntelWarn("Failed to persist saved views", e);
  }
};

export const upsertSavedExecutiveView = (view: SavedExecutiveView) => {
  const cur = readSavedExecutiveViews().filter((v) => v.id !== view.id);
  cur.unshift(view);
  writeSavedExecutiveViews(cur);
};

export const deleteSavedExecutiveView = (id: string) => {
  writeSavedExecutiveViews(readSavedExecutiveViews().filter((v) => v.id !== id));
};
