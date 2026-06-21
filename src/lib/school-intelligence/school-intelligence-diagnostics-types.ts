import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type { SchoolIntelligenceQuerySourceEntry } from "@/lib/school-intelligence/school-intelligence-query-source-trace";
import type { SchoolIntelligenceChunkRecoveryDiagnostics } from "@/lib/school-intelligence/school-intelligence-bson-safety";
import type { SchoolIntelligenceBsonSerializationTrace } from "@/lib/school-intelligence/school-intelligence-bson-serialization-trace";
import type { SchoolIntelligenceSnapshotPayloadTrace } from "@/lib/school-intelligence/school-intelligence-snapshot-payload-trace";

export type SchoolIntelligenceBuildStatus = "success" | "degraded" | "unavailable";

export type SchoolIntelligenceStepTiming = {
  step: string;
  durationMs: number;
  documentsReturned?: number;
  detail?: string;
};

export type SchoolIntelligenceFirstFailureDiagnostics = {
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
  filterKeys?: string[];
  projectionKeys?: string[];
  sourceVariableName?: string;
  sourceFunction?: string;
  uniqueValues?: number;
  duplicateValues?: number;
  firstFiveValues?: string[];
  lastFiveValues?: string[];
  totalSerializedBytes?: number;
  fieldBytes?: Record<string, number>;
  filterBytes?: number;
  projectionBytes?: number;
  optionsBytes?: number;
  populateBytes?: number;
  pipelineBytes?: number;
  offendingComponent?: import("@/lib/school-intelligence/school-intelligence-bson-serialization-trace").SchoolIntelligenceBsonComponent;
  serializationBreakdown?: import("@/lib/school-intelligence/school-intelligence-bson-serialization-trace").SchoolIntelligenceSerializationBreakdown;
  preSerializeSnapshot?: import("@/lib/school-intelligence/school-intelligence-bson-serialization-trace").SchoolIntelligencePreSerializeSnapshot;
};

export type SchoolIntelligenceQuerySourceMapEntry = SchoolIntelligenceQuerySourceEntry;

export type { SchoolIntelligenceChunkRecoveryDiagnostics } from "@/lib/school-intelligence/school-intelligence-bson-safety";
export type { SchoolIntelligenceBsonSerializationTrace } from "@/lib/school-intelligence/school-intelligence-bson-serialization-trace";
export type { SchoolIntelligenceSnapshotPayloadTrace } from "@/lib/school-intelligence/school-intelligence-snapshot-payload-trace";

export type SchoolIntelligenceSnapshotSaveDiagnostics = {
  attempted: boolean;
  succeeded: boolean;
  errorName?: string;
  errorMessage?: string;
  timestamp?: string;
};

export type SchoolIntelligenceDiagnostics = {
  generatedAt: string;
  status: SchoolIntelligenceBuildStatus;
  totalDurationMs: number;
  steps: SchoolIntelligenceStepTiming[];
  warnings: string[];
  snapshotFallback: boolean;
  messageAr?: string;
  messageEn?: string;
  timeoutSource?: string;
  runtimeVersion?: string;
  buildTimestamp?: string;
  firstFailure?: SchoolIntelligenceFirstFailureDiagnostics;
  snapshotSave?: SchoolIntelligenceSnapshotSaveDiagnostics;
  querySourceMap?: SchoolIntelligenceQuerySourceMapEntry[];
  chunkRecovery?: SchoolIntelligenceChunkRecoveryDiagnostics[];
  bsonSerializationTraces?: SchoolIntelligenceBsonSerializationTrace[];
  snapshotPayloadTrace?: SchoolIntelligenceSnapshotPayloadTrace;
};

export type SchoolIntelligenceBuildResult = {
  intelligence: SchoolIntelligencePayload;
  diagnostics: SchoolIntelligenceDiagnostics;
};

export const createEmptySchoolIntelligencePayload = (): SchoolIntelligencePayload => ({
  generatedAt: new Date().toISOString(),
  studentSuccessGraph: {
    totalNodes: 0,
    topStudents: [],
    avgSuccessIndex: 0,
  },
  departmentExcellence: [],
  schoolExcellence: {
    excellenceIndex: 0,
    avgStudentSuccessIndex: 0,
    totalStudents: 0,
    activeParticipants: 0,
    participationRatePct: 0,
    yearOverYearGrowthPct: 0,
    evidence: "",
  },
  longitudinalGrowth: [],
  talentDiscovery: [],
  interventions: [],
  opportunityMapping: [],
  strategicInsights: [],
  governance: {
    readOnly: true,
    explainable: true,
    deterministic: true,
    dataSources: [],
  },
});

export const createEmptyStudentIntelligencePayload = (): StudentIntelligencePayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: { status: "approved" },
  byWeightedScore: [],
  byParticipation: [],
  byMedals: [],
  bySuccessRate: [],
  byActivityDiversity: [],
  byFastestGrowth: [],
});
