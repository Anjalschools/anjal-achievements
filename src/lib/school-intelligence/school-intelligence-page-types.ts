import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type {
  SchoolIntelligenceBsonSerializationTrace,
  SchoolIntelligenceChunkRecoveryDiagnostics,
  SchoolIntelligenceFirstFailureDiagnostics,
  SchoolIntelligenceQuerySourceMapEntry,
  SchoolIntelligenceSnapshotPayloadTrace,
  SchoolIntelligenceSnapshotPolicyDiagnostics,
  TalentDiscoveryDiagnostics,
  SchoolIntelligenceFinalReadinessDiagnostics,
} from "@/lib/school-intelligence/school-intelligence-diagnostics-types";

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
  firstFailure?: SchoolIntelligenceFirstFailureDiagnostics;
  snapshotSave?: {
    attempted: boolean;
    succeeded: boolean;
    errorName?: string;
    errorMessage?: string;
    timestamp?: string;
  };
  querySourceMap?: SchoolIntelligenceQuerySourceMapEntry[];
  chunkRecovery?: SchoolIntelligenceChunkRecoveryDiagnostics[];
  bsonSerializationTraces?: SchoolIntelligenceBsonSerializationTrace[];
  snapshotPayloadTrace?: SchoolIntelligenceSnapshotPayloadTrace;
  snapshotPolicy?: SchoolIntelligenceSnapshotPolicyDiagnostics[];
  talentDiscovery?: TalentDiscoveryDiagnostics;
  finalReadiness?: SchoolIntelligenceFinalReadinessDiagnostics;
  executiveSummary?: import("@/lib/school-intelligence/school-intelligence-executive-summary").SchoolIntelligenceExecutiveSummary;
  sectionReports?: Partial<Record<SchoolIntelligenceSectionKey, { status: SchoolIntelligenceSectionStatus }>>;
  snapshotDiagnostics?: import("@/lib/school-intelligence/school-intelligence-diagnostics-schema").SchoolIntelligenceSnapshotDiagnostics;
  schemaVersion?: string;
  schemaPolicy?: string;
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

export type SchoolIntelligenceSectionStatus = "available" | "snapshot" | "no_data" | "unavailable";

export type {
  SchoolIntelligenceFinalReadinessDiagnostics,
  TalentDiscoveryDiagnostics,
  SchoolIntelligenceExecutiveSummary,
} from "@/lib/school-intelligence/school-intelligence-diagnostics-types";
