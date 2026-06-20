import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

export type SchoolIntelligenceBuildStatus = "success" | "degraded" | "unavailable";

export type SchoolIntelligencePageDiagnostics = {
  generatedAt?: string;
  status?: SchoolIntelligenceBuildStatus;
  totalDurationMs?: number;
  warnings?: string[];
  snapshotFallback?: boolean;
  snapshotUsed?: boolean;
  snapshotMetadata?: { exists?: boolean; capturedAt?: string };
  messageAr?: string;
  messageEn?: string;
  runtimeVersion?: string;
  buildTimestamp?: string;
  timeoutSource?: string;
  steps?: Array<{ step: string; durationMs: number; detail?: string }>;
  firstFailure?: {
    section: string;
    service: string;
    errorName: string;
    errorMessage: string;
    stack?: string;
    timestamp: string;
    durationMs: number;
    mongoCollection?: string;
    mongoOperation?: string;
    queryName?: string;
    timeoutMs?: number;
    documentsReturned?: number;
    failureClassification?: string;
    querySizeBytes?: number;
    pipelineSizeBytes?: number;
    arrayLength?: number;
    serializedBytes?: number;
    limitBytes?: number;
    offendingFilterPath?: string;
  };
  snapshotSave?: {
    attempted: boolean;
    succeeded: boolean;
    errorName?: string;
    errorMessage?: string;
    timestamp?: string;
  };
};

export type SectionEmptyKind = "no_data" | "failure" | "snapshot";

export type AdminActionFeedback = {
  state: "idle" | "loading" | "success" | "failure";
  durationMs?: number;
  messageAr?: string;
  messageEn?: string;
};

export type SchoolIntelligenceApiResponse = {
  success?: boolean;
  ok?: boolean;
  status?: SchoolIntelligenceBuildStatus;
  intelligence?: SchoolIntelligencePayload;
  diagnostics?: SchoolIntelligencePageDiagnostics;
  messageAr?: string;
  messageEn?: string;
};

export type SchoolIntelligenceSectionKey =
  | "summary"
  | "strategic_insights"
  | "student_success"
  | "department_excellence"
  | "talent_discovery"
  | "interventions"
  | "opportunity_mapping"
  | "longitudinal_growth";

export type SchoolIntelligenceSectionStatus = "available" | "snapshot" | "unavailable";
