/**
 * Readiness layer for competition intelligence governance modes.
 * Does not replace RBAC — layers presentation/audit behavior on top of existing access.
 */

export type CompetitionGovernanceMode =
  | "executive_mode"
  | "analytics_mode"
  | "audit_mode"
  | "readonly_presentation_mode";

export type CompetitionGovernanceProfile = {
  mode: CompetitionGovernanceMode;
  allowExport: boolean;
  allowCompare: boolean;
  showDiagnostics: boolean;
  showAuditTrail: boolean;
  preferSnapshotReplay: boolean;
  emphasizeBaselines: boolean;
};

const PROFILES: Record<CompetitionGovernanceMode, CompetitionGovernanceProfile> = {
  executive_mode: {
    mode: "executive_mode",
    allowExport: true,
    allowCompare: true,
    showDiagnostics: false,
    showAuditTrail: false,
    preferSnapshotReplay: false,
    emphasizeBaselines: true,
  },
  analytics_mode: {
    mode: "analytics_mode",
    allowExport: true,
    allowCompare: true,
    showDiagnostics: true,
    showAuditTrail: false,
    preferSnapshotReplay: false,
    emphasizeBaselines: true,
  },
  audit_mode: {
    mode: "audit_mode",
    allowExport: true,
    allowCompare: true,
    showDiagnostics: true,
    showAuditTrail: true,
    preferSnapshotReplay: true,
    emphasizeBaselines: true,
  },
  readonly_presentation_mode: {
    mode: "readonly_presentation_mode",
    allowExport: false,
    allowCompare: false,
    showDiagnostics: false,
    showAuditTrail: false,
    preferSnapshotReplay: true,
    emphasizeBaselines: false,
  },
};

export const parseGovernanceMode = (raw: string | null | undefined): CompetitionGovernanceMode => {
  const v = String(raw || "").trim() as CompetitionGovernanceMode;
  if (v in PROFILES) return v;
  return "executive_mode";
};

export const getGovernanceProfile = (mode?: CompetitionGovernanceMode): CompetitionGovernanceProfile =>
  PROFILES[mode ?? "executive_mode"];

export const resolveGovernanceModeFromEnv = (): CompetitionGovernanceMode => {
  const env = process.env.COMPETITION_INTEL_GOVERNANCE_MODE?.trim();
  return parseGovernanceMode(env);
};
