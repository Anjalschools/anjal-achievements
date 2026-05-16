/**
 * Client-side export audit ring buffer (no PII — counts and filter hash only).
 */

import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";

const STORAGE_KEY = "anjal-ci-export-audit-v2";
const MAX = 30;

export type CiExportAuditEntry = {
  ts: string;
  status: "success" | "failure";
  durationMs: number;
  preset?: string;
  rowCount?: number;
  activityFocus?: string;
  compareMode?: boolean;
  filtersDigest?: string;
  /** Same digest as filtersDigest; kept for institutional audit wording. */
  filtersSnapshot?: string;
  correlationId?: string;
  exportStatus?: "success" | "failure";
  retryCount?: number;
  failedSections?: string[];
  /** Aggregation logic version that produced the export dataset */
  aggregationVersion?: number;
  /** Client-side cache age at export time (ms) */
  cacheAge?: number;
  /** Trust layer summary at export time */
  trustStatus?: string;
  /** Compare activity keys when compare mode was active */
  compareTargets?: string[];
  /** PDF preset id */
  exportPreset?: string;
  /** Snapshot payload version when replay/historical export */
  snapshotVersion?: number;
  /** Short diagnostics summary (no PII) */
  diagnosticsSummary?: string;
  /** Degraded export mode flag */
  degradedExport?: boolean;
};

const safeParse = (raw: string | null): CiExportAuditEntry[] => {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return j.filter((x) => x && typeof x === "object" && "ts" in x && "status" in x) as CiExportAuditEntry[];
  } catch {
    return [];
  }
};

export const readCiExportAudit = (): CiExportAuditEntry[] => {
  if (typeof window === "undefined") return [];
  const v2 = safeParse(localStorage.getItem(STORAGE_KEY));
  if (v2.length) return v2;
  return safeParse(localStorage.getItem("anjal-ci-export-audit-v1"));
};

export const appendCiExportAudit = (entry: CiExportAuditEntry) => {
  if (typeof window === "undefined") return;
  try {
    const cur = readCiExportAudit();
    const enriched: CiExportAuditEntry = {
      aggregationVersion: CI_AGGREGATION_VERSION,
      ...entry,
    };
    cur.unshift(enriched);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur.slice(0, MAX)));
  } catch {
    /* ignore */
  }
};

export const buildDiagnosticsSummary = (parts: Record<string, string | number | boolean | undefined>): string => {
  return Object.entries(parts)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(";")
    .slice(0, 240);
};
