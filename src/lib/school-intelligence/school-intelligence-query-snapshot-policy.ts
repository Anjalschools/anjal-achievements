import { measureSerializedBytes } from "@/lib/school-intelligence/school-intelligence-bson-safety";
import {
  SNAPSHOT_PAYLOAD_LIMIT_BYTES,
  SNAPSHOT_PAYLOAD_WARN_BYTES,
} from "@/lib/school-intelligence/school-intelligence-snapshot-payload-trace";

export type QuerySnapshotMode = "full" | "metadata_only" | "disabled";

export type SchoolIntelligenceSnapshotPolicyDiagnostics = {
  mode: QuerySnapshotMode;
  originalBytes: number;
  storedBytes: number;
  downgraded: boolean;
  saveTarget: string;
  queryName: string;
  collection: string;
};

export type QuerySnapshotMetadataPayload = {
  snapshotMode: "metadata_only";
  count: number;
  executionMs: number;
  generatedAt: string;
  queryName: string;
  collection: string;
  sampleIds: string[];
  checksum: string;
};

export const QUERY_SNAPSHOT_DISABLED_KEYS = new Set([
  "users:find_students",
  "users:find_profiles",
]);

const SAMPLE_ID_LIMIT = 20;

const stableChecksum = (input: {
  count: number;
  queryName: string;
  collection: string;
  sampleIds: string[];
}): string => {
  const seed = `${input.collection}|${input.queryName}|${input.count}|${input.sampleIds.join(",")}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const extractQueryResultSampleIds = (result: unknown, max = SAMPLE_ID_LIMIT): string[] => {
  if (result == null) return [];

  if (Array.isArray(result)) {
    const sampleIds: string[] = [];
    for (const item of result) {
      if (sampleIds.length >= max) break;
      if (item == null || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const id = record._id ?? record.studentId ?? record.userId ?? record.id;
      if (id != null) sampleIds.push(String(id));
    }
    return sampleIds;
  }

  if (typeof result === "object") {
    const record = result as Record<string, unknown>;
    const id = record._id ?? record.studentId ?? record.userId ?? record.id;
    return id != null ? [String(id)] : [];
  }

  return [];
};

export const estimateQueryResultCount = (result: unknown): number => {
  if (result == null) return 0;
  if (Array.isArray(result)) return result.length;
  if (typeof result === "number") return result;
  return 1;
};

export const buildQuerySnapshotMetadataPayload = (input: {
  result: unknown;
  collection: string;
  queryName: string;
  executionMs: number;
  generatedAt?: string;
}): QuerySnapshotMetadataPayload => {
  const count = estimateQueryResultCount(input.result);
  const sampleIds = extractQueryResultSampleIds(input.result);
  return {
    snapshotMode: "metadata_only",
    count,
    executionMs: input.executionMs,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    queryName: input.queryName,
    collection: input.collection,
    sampleIds,
    checksum: stableChecksum({
      count,
      queryName: input.queryName,
      collection: input.collection,
      sampleIds,
    }),
  };
};

export const resolveQuerySnapshotMode = (
  snapshotKey: string,
  originalBytes: number
): Pick<SchoolIntelligenceSnapshotPolicyDiagnostics, "mode" | "downgraded"> => {
  if (QUERY_SNAPSHOT_DISABLED_KEYS.has(snapshotKey)) {
    return { mode: "disabled", downgraded: false };
  }
  if (originalBytes > SNAPSHOT_PAYLOAD_LIMIT_BYTES) {
    return { mode: "disabled", downgraded: true };
  }
  if (originalBytes > SNAPSHOT_PAYLOAD_WARN_BYTES) {
    return { mode: "metadata_only", downgraded: true };
  }
  return { mode: "full", downgraded: false };
};

export type ApplyQuerySnapshotPolicyInput = {
  snapshotKey: string;
  saveTarget: string;
  payload: unknown;
  collection: string;
  queryName: string;
  executionMs: number;
};

export type ApplyQuerySnapshotPolicyResult = {
  shouldPersist: boolean;
  payload: unknown;
  diagnostics: SchoolIntelligenceSnapshotPolicyDiagnostics;
};

export const applyQuerySnapshotPolicy = (
  input: ApplyQuerySnapshotPolicyInput
): ApplyQuerySnapshotPolicyResult => {
  const originalBytes = measureSerializedBytes(input.payload);
  const { mode, downgraded } = resolveQuerySnapshotMode(input.snapshotKey, originalBytes);

  if (mode === "disabled") {
    return {
      shouldPersist: false,
      payload: input.payload,
      diagnostics: {
        mode,
        originalBytes,
        storedBytes: 0,
        downgraded,
        saveTarget: input.saveTarget,
        queryName: input.queryName,
        collection: input.collection,
      },
    };
  }

  if (mode === "metadata_only") {
    const metadataPayload = buildQuerySnapshotMetadataPayload({
      result: input.payload,
      collection: input.collection,
      queryName: input.queryName,
      executionMs: input.executionMs,
    });
    return {
      shouldPersist: true,
      payload: metadataPayload,
      diagnostics: {
        mode,
        originalBytes,
        storedBytes: measureSerializedBytes(metadataPayload),
        downgraded,
        saveTarget: input.saveTarget,
        queryName: input.queryName,
        collection: input.collection,
      },
    };
  }

  return {
    shouldPersist: true,
    payload: input.payload,
    diagnostics: {
      mode,
      originalBytes,
      storedBytes: originalBytes,
      downgraded,
      saveTarget: input.saveTarget,
      queryName: input.queryName,
      collection: input.collection,
    },
  };
};
