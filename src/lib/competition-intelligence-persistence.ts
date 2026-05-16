import type { CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { CI_STORAGE_KEYS } from "@/lib/competition-intelligence-theme";
import { competitionIntelDebug, competitionIntelWarn } from "@/lib/competition-intelligence-diagnostics";

const SAVED_VIEWS_KEY = "anjal-ci-saved-views-v1";
const MAX_SAVED = 12;

/** Serializable filter slice for executive restore (matches participation report filter shape). */
export type ExecutiveFilterSnapshot = {
  academicYear: string;
  gender: string;
  mawhiba: string;
  stage: string;
  grade: string;
  section: string;
  categories: string[];
  primaryType: string;
  levels: string[];
  resultTokens: string[];
  status: string;
  certificateStatus: string;
  fromDate: string;
  toDate: string;
  domain: string;
  classification: string;
  organization: string;
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
});

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
  }
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
