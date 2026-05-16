/**
 * Client-side export audit ring buffer (no PII — counts and filter hash only).
 */

const STORAGE_KEY = "anjal-ci-export-audit-v1";
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
  return safeParse(localStorage.getItem(STORAGE_KEY));
};

export const appendCiExportAudit = (entry: CiExportAuditEntry) => {
  if (typeof window === "undefined") return;
  try {
    const cur = readCiExportAudit();
    cur.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur.slice(0, MAX)));
  } catch {
    /* ignore */
  }
};
