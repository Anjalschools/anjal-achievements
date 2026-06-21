import { measureSerializedBytes } from "@/lib/school-intelligence/school-intelligence-bson-safety";
import { recordSchoolIntelligenceSnapshotPayloadTrace } from "@/lib/school-intelligence/school-intelligence-section-tracer";

export const SNAPSHOT_PAYLOAD_WARN_BYTES = Number(
  process.env.SCHOOL_INTEL_SNAPSHOT_WARN_BYTES || 8_000_000
);
export const SNAPSHOT_PAYLOAD_LIMIT_BYTES = Number(
  process.env.SCHOOL_INTEL_SNAPSHOT_LIMIT_BYTES || 16_000_000
);

export const SNAPSHOT_TRACKED_FIELD_KEYS = [
  "graph",
  "nodes",
  "edges",
  "students",
  "profiles",
  "achievements",
  "diagnostics",
  "intelligence",
  "opportunities",
  "growth",
  "strategicInsights",
] as const;

export type SchoolIntelligenceSnapshotFieldSizes = Partial<
  Record<(typeof SNAPSHOT_TRACKED_FIELD_KEYS)[number], number>
>;

export type SchoolIntelligenceSnapshotPayloadTrace = {
  payloadBytes: number;
  jsonBytes: number;
  topLevelKeys: string[];
  largestTopLevelField?: string;
  largestFieldBytes?: number;
  fieldSizes: SchoolIntelligenceSnapshotFieldSizes;
  saveTarget: string;
};

export class SchoolIntelligenceSnapshotPayloadTooLargeError extends Error {
  readonly snapshotPayloadTrace: SchoolIntelligenceSnapshotPayloadTrace;

  constructor(trace: SchoolIntelligenceSnapshotPayloadTrace) {
    super("snapshot_payload_too_large");
    this.name = "SchoolIntelligenceSnapshotPayloadTooLargeError";
    this.snapshotPayloadTrace = trace;
  }
};

export const extractSnapshotPayloadTrace = (
  error: unknown
): SchoolIntelligenceSnapshotPayloadTrace | undefined => {
  if (error instanceof SchoolIntelligenceSnapshotPayloadTooLargeError) {
    return error.snapshotPayloadTrace;
  }
  return undefined;
};

const walkTrackedFieldSizes = (
  value: unknown,
  sizes: SchoolIntelligenceSnapshotFieldSizes
): void => {
  if (value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkTrackedFieldSizes(item, sizes));
    return;
  }

  for (const [key, node] of Object.entries(value as Record<string, unknown>)) {
    if (SNAPSHOT_TRACKED_FIELD_KEYS.includes(key as (typeof SNAPSHOT_TRACKED_FIELD_KEYS)[number])) {
      const bytes = measureSerializedBytes(node);
      const current = sizes[key as keyof SchoolIntelligenceSnapshotFieldSizes] ?? 0;
      sizes[key as keyof SchoolIntelligenceSnapshotFieldSizes] = Math.max(current, bytes);
    }
    walkTrackedFieldSizes(node, sizes);
  }
};

export const buildSnapshotFieldSizes = (payload: unknown): SchoolIntelligenceSnapshotFieldSizes => {
  const sizes: SchoolIntelligenceSnapshotFieldSizes = {};
  walkTrackedFieldSizes(payload, sizes);
  return sizes;
};

export const analyzeSnapshotPayload = (
  payload: unknown,
  saveTarget: string
): SchoolIntelligenceSnapshotPayloadTrace => {
  const jsonBytes = measureSerializedBytes(payload);
  const payloadBytes = jsonBytes;
  let topLevelKeys: string[] = [];
  let largestTopLevelField: string | undefined;
  let largestFieldBytes = 0;

  if (payload != null && typeof payload === "object" && !Array.isArray(payload)) {
    topLevelKeys = Object.keys(payload as Record<string, unknown>);
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      const bytes = measureSerializedBytes(value);
      if (bytes > largestFieldBytes) {
        largestFieldBytes = bytes;
        largestTopLevelField = key;
      }
    }
  }

  return {
    payloadBytes,
    jsonBytes,
    topLevelKeys,
    largestTopLevelField,
    largestFieldBytes: largestFieldBytes || undefined,
    fieldSizes: buildSnapshotFieldSizes(payload),
    saveTarget,
  };
};

export const resolveSnapshotSaveTarget = (kind: string, key: string) => `${kind}:${key}`;

export const guardSnapshotPayloadBeforeSave = (
  payload: unknown,
  saveTarget: string
): SchoolIntelligenceSnapshotPayloadTrace => {
  const trace = analyzeSnapshotPayload(payload, saveTarget);
  recordSchoolIntelligenceSnapshotPayloadTrace(trace);

  console.info("[SnapshotPayloadTrace]", {
    saveTarget: trace.saveTarget,
    payloadBytes: trace.payloadBytes,
    jsonBytes: trace.jsonBytes,
    topLevelKeys: trace.topLevelKeys,
    largestTopLevelField: trace.largestTopLevelField,
    largestFieldBytes: trace.largestFieldBytes,
    fieldSizes: trace.fieldSizes,
  });

  if (trace.payloadBytes > SNAPSHOT_PAYLOAD_WARN_BYTES) {
    console.warn("[SnapshotPayloadTrace] payload exceeds warning threshold", {
      saveTarget: trace.saveTarget,
      payloadBytes: trace.payloadBytes,
      warnBytes: SNAPSHOT_PAYLOAD_WARN_BYTES,
      largestTopLevelField: trace.largestTopLevelField,
      largestFieldBytes: trace.largestFieldBytes,
    });
  }

  if (trace.payloadBytes > SNAPSHOT_PAYLOAD_LIMIT_BYTES) {
    throw new SchoolIntelligenceSnapshotPayloadTooLargeError(trace);
  }

  return trace;
};

export const formatSnapshotFieldSizesSummary = (
  fieldSizes: SchoolIntelligenceSnapshotFieldSizes
): string =>
  Object.entries(fieldSizes)
    .filter(([, bytes]) => bytes != null && bytes > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([field, bytes]) => `${field}: ${bytes}B`)
    .join(", ");
