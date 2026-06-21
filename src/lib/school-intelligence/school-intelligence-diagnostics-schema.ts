/**
 * School Intelligence diagnostics schema — frozen at v10.3.3 (Phase D.13).
 * Future changes must be additive only. No breaking schema changes.
 */
export const SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_VERSION = "10.3.3";

export const SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_POLICY = "additive-only" as const;

export const LOCKED_SCHOOL_INTELLIGENCE_DIAGNOSTICS_FIELDS = [
  "sectionReports",
  "talentDiscovery",
  "querySourceMap",
  "snapshotDiagnostics",
  "finalReadiness",
] as const;

export type LockedSchoolIntelligenceDiagnosticsField =
  (typeof LOCKED_SCHOOL_INTELLIGENCE_DIAGNOSTICS_FIELDS)[number];

export type SchoolIntelligenceDiagnosticsSchemaMeta = {
  schemaVersion: typeof SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_VERSION;
  schemaPolicy: typeof SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_POLICY;
  lockedFields: readonly LockedSchoolIntelligenceDiagnosticsField[];
};

export const buildSchoolIntelligenceDiagnosticsSchemaMeta =
  (): SchoolIntelligenceDiagnosticsSchemaMeta => ({
    schemaVersion: SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_VERSION,
    schemaPolicy: SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_POLICY,
    lockedFields: LOCKED_SCHOOL_INTELLIGENCE_DIAGNOSTICS_FIELDS,
  });

/** Snapshot-related diagnostics grouped under the locked snapshotDiagnostics namespace. */
export type SchoolIntelligenceSnapshotDiagnostics = {
  snapshotSave?: {
    attempted: boolean;
    succeeded: boolean;
    errorName?: string;
    errorMessage?: string;
    timestamp?: string;
  };
  snapshotPayloadTrace?: import("@/lib/school-intelligence/school-intelligence-snapshot-payload-trace").SchoolIntelligenceSnapshotPayloadTrace;
  snapshotPolicy?: import("@/lib/school-intelligence/school-intelligence-query-snapshot-policy").SchoolIntelligenceSnapshotPolicyDiagnostics[];
};
