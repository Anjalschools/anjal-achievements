import { createSchoolIntelligenceMongoFailureError } from "@/lib/school-intelligence/school-intelligence-root-cause-capture";

export const BSON_QUERY_SAFE_LIMIT_BYTES = Number(
  process.env.SCHOOL_INTEL_BSON_QUERY_LIMIT_BYTES || 16_000_000
);
export const BSON_IN_ARRAY_CHUNK_BYTES = Number(
  process.env.SCHOOL_INTEL_BSON_IN_CHUNK_BYTES || 4_000_000
);
export const BSON_IN_BATCH_COUNT = Number(
  process.env.SCHOOL_INTEL_BSON_IN_BATCH_COUNT || 5000
);
export const BSON_CHUNK_IN_FIELD_NAMES = ["_id", "studentId", "userId"] as const;

export type SchoolIntelligenceChunkRecoveryDiagnostics = {
  queryName: string;
  collection: string;
  chunkCount: number;
  chunkSize: number;
  chunkExecutionMs: number;
  chunkedRecoveryUsed: boolean;
};

const FORBIDDEN_FILTER_KEYS = new Set([
  "diagnostics",
  "snapshot",
  "snapshots",
  "report",
  "reports",
  "monitoring",
  "payload",
  "full_payload",
  "intelligence",
  "generatedAt",
  "monitoringPayload",
]);

export type MongoQueryInstrumentation = {
  querySizeBytes: number;
  pipelineSizeBytes: number;
  idCount: number;
  projectionFields: string[];
  arrayLength?: number;
  serializedBytes?: number;
  offendingFilterPath?: string;
  limitBytes?: number;
};

export type MongoQueryGuardInput = {
  collection: string;
  operation: string;
  pipelineName?: string;
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  pipeline?: unknown[];
  timeoutMs: number;
};

export const measureSerializedBytes = (value: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null));
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

export const normalizeFilterPath = (path: string): string =>
  path.replace(/^filter\./, "").replace(/^\$match\./, "$match.");

export const extractProjectionFields = (
  projection: string | Record<string, unknown> | undefined
): string[] => {
  if (!projection) return [];
  if (typeof projection === "string") {
    return projection
      .split(/\s+/)
      .map((field) => field.trim())
      .filter(Boolean);
  }
  return Object.keys(projection);
};

const isObjectIdLike = (value: unknown): boolean => {
  if (value == null || typeof value !== "object") return false;
  if ("_bsontype" in value) return true;
  return typeof (value as { toHexString?: () => string }).toHexString === "function";
};

const isAllowedFilterPrimitive = (value: unknown): boolean => {
  if (value == null) return true;
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") return true;
  if (value instanceof Date) return true;
  return isObjectIdLike(value);
};

const isMongoOperatorObject = (value: Record<string, unknown>): boolean =>
  Object.keys(value).every((key) => key.startsWith("$"));

const walkFilter = (
  value: unknown,
  path: string,
  visit: (path: string, key: string, node: unknown) => void
): void => {
  if (value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkFilter(item, `${path}[${index}]`, visit));
    return;
  }

  const record = value as Record<string, unknown>;
  for (const [key, node] of Object.entries(record)) {
    visit(path, key, node);
    if (node != null && typeof node === "object") {
      walkFilter(node, `${path}.${key}`, visit);
    }
  }
};

export const countIdsInFilter = (filter: unknown): number => {
  let count = 0;
  walkFilter(filter, "filter", (_path, key, node) => {
    if (key === "$in" && Array.isArray(node)) {
      count += node.length;
      return;
    }
    if (key === "_id" && !Array.isArray(node) && node != null && typeof node !== "object") {
      count += 1;
    }
  });
  return count;
};

export type LargeArrayFilterInfo = {
  path: string;
  arrayLength: number;
  serializedBytes: number;
};

export const findLargeArrayFilters = (filter: unknown): LargeArrayFilterInfo[] => {
  const matches: LargeArrayFilterInfo[] = [];
  walkFilter(filter, "filter", (path, key, node) => {
    if (key !== "$in" || !Array.isArray(node)) return;
    matches.push({
      path: `${path}.$in`,
      arrayLength: node.length,
      serializedBytes: measureSerializedBytes(node),
    });
  });
  return matches;
};

export const findForbiddenFilterObjects = (filter: unknown): string[] => {
  const violations: string[] = [];

  walkFilter(filter, "filter", (path, key, node) => {
    if (FORBIDDEN_FILTER_KEYS.has(key)) {
      violations.push(`${path}.${key}`);
    }

    if (key === "$in" && Array.isArray(node)) {
      for (const [index, item] of node.entries()) {
        if (item != null && typeof item === "object" && !isAllowedFilterPrimitive(item)) {
          const keys = Object.keys(item as Record<string, unknown>);
          if (keys.length > 1 || (keys.length === 1 && keys[0] !== "_id")) {
            violations.push(`${path}.$in[${index}]`);
          }
        }
      }
    }

    if (!key.startsWith("$") && node != null && typeof node === "object" && !Array.isArray(node)) {
      const record = node as Record<string, unknown>;
      if (!isMongoOperatorObject(record)) {
        const nestedKeys = Object.keys(record);
        if (nestedKeys.length > 3) {
          violations.push(`${path}.${key}`);
        }
      }
    }
  });

  return violations;
};

export const sanitizeInArrayValue = (value: unknown): unknown => {
  if (value == null || isAllowedFilterPrimitive(value)) return value;
  if (typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_FILTER_KEYS.has(key)) {
      throw createSchoolIntelligenceMongoFailureError(new Error("query_payload_too_large"), {
        mongoCollection: "unknown",
        mongoOperation: "sanitize",
        timeoutMs: 0,
        durationMs: 0,
        documentsReturned: 0,
        offendingFilterPath: `$in.${key}`,
      });
    }
  }
  if ("_id" in record) return sanitizeInArrayValue(record._id);
  if (isObjectIdLike(value)) return value;
  throw createSchoolIntelligenceMongoFailureError(new Error("query_payload_too_large"), {
    mongoCollection: "unknown",
    mongoOperation: "sanitize",
    timeoutMs: 0,
    durationMs: 0,
    documentsReturned: 0,
    offendingFilterPath: "$in[object]",
  });
};

export const sanitizeMongoFilter = <T extends Record<string, unknown>>(filter: T): T => {
  const cloned = structuredClone(filter) as T;
  walkFilter(cloned, "filter", (_path, key, node) => {
    if (key !== "$in" || !Array.isArray(node)) return;
    const parent = node as unknown[];
    for (let index = 0; index < parent.length; index += 1) {
      parent[index] = sanitizeInArrayValue(parent[index]);
    }
  });
  return cloned;
};

type ChunkableInTarget = {
  parentPath: string[];
  values: unknown[];
  normalizedPath: string;
};

const resolveChunkableInTarget = (filter: Record<string, unknown>): ChunkableInTarget | null => {
  let target: ChunkableInTarget | null = null;
  walkFilter(filter, "filter", (path, key, node) => {
    if (key !== "$in" || !Array.isArray(node)) return;
    const parentKey = path.split(".").pop();
    if (!parentKey || !BSON_CHUNK_IN_FIELD_NAMES.includes(parentKey as (typeof BSON_CHUNK_IN_FIELD_NAMES)[number])) {
      return;
    }
    const normalizedPath = normalizeFilterPath(`${path}.${key}`);
    if (!target || node.length > target.values.length) {
      target = {
        parentPath: path.replace(/^filter\./, "").split("."),
        values: node,
        normalizedPath,
      };
    }
  });
  return target;
};

const applyInChunk = (
  filter: Record<string, unknown>,
  target: ChunkableInTarget,
  chunk: unknown[]
): Record<string, unknown> => {
  const cloned = structuredClone(filter) as Record<string, unknown>;
  let cursor: Record<string, unknown> = cloned;
  for (const part of target.parentPath.slice(0, -1)) {
    cursor = cursor[part] as Record<string, unknown>;
  }
  const leafKey = target.parentPath[target.parentPath.length - 1];
  cursor[leafKey] = { $in: chunk };
  return cloned;
};

export const splitFilterByInCount = (
  filter: Record<string, unknown>,
  batchSize: number = BSON_IN_BATCH_COUNT
): Record<string, unknown>[] => {
  const target = resolveChunkableInTarget(filter);
  if (!target || target.values.length <= batchSize) return [filter];

  const chunks: unknown[][] = [];
  for (let index = 0; index < target.values.length; index += batchSize) {
    chunks.push(target.values.slice(index, index + batchSize));
  }
  if (chunks.length <= 1) return [filter];
  return chunks.map((chunk) => applyInChunk(filter, target!, chunk));
};

export const resolveFilterChunks = (
  filter: Record<string, unknown>
): { chunks: Record<string, unknown>[]; chunkSize: number; chunkedRecoveryUsed: boolean } => {
  const countChunks = splitFilterByInCount(filter, BSON_IN_BATCH_COUNT);
  const byteChunks = splitFilterByInArraySize(filter, BSON_IN_ARRAY_CHUNK_BYTES);
  const chunks = countChunks.length >= byteChunks.length ? countChunks : byteChunks;
  if (chunks.length <= 1) {
    return { chunks: [filter], chunkSize: 0, chunkedRecoveryUsed: false };
  }
  const chunkSize =
    countChunks.length >= byteChunks.length
      ? BSON_IN_BATCH_COUNT
      : Math.max(1, Math.ceil((resolveChunkableInTarget(filter)?.values.length ?? 0) / chunks.length));
  return { chunks, chunkSize, chunkedRecoveryUsed: true };
};

export const shouldAutoChunkFilter = (filter: Record<string, unknown>): boolean => {
  const instrumentation = buildMongoQueryInstrumentation({ filter });
  if (instrumentation.querySizeBytes > BSON_QUERY_SAFE_LIMIT_BYTES) return true;
  if ((instrumentation.arrayLength ?? 0) > BSON_IN_BATCH_COUNT) return true;
  return findLargeArrayFilters(filter).some(
    (entry) =>
      entry.serializedBytes > BSON_IN_ARRAY_CHUNK_BYTES || entry.arrayLength > BSON_IN_BATCH_COUNT
  );
};

export const buildMongoQueryInstrumentation = (input: {
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  pipeline?: unknown[];
}): MongoQueryInstrumentation => {
  const querySizeBytes = measureSerializedBytes(input.filter ?? {});
  const pipelineSizeBytes = measureSerializedBytes(input.pipeline ?? []);
  const largeArrays = findLargeArrayFilters(input.filter);
  const largestArray = largeArrays.sort((a, b) => b.serializedBytes - a.serializedBytes)[0];

  return {
    querySizeBytes,
    pipelineSizeBytes,
    idCount: countIdsInFilter(input.filter),
    projectionFields: extractProjectionFields(input.projection),
    arrayLength: largestArray?.arrayLength,
    serializedBytes: largestArray?.serializedBytes ?? querySizeBytes,
  };
};

export const splitFilterByInArraySize = (
  filter: Record<string, unknown>,
  maxBytes: number
): Record<string, unknown>[] => {
  const largeArrays = findLargeArrayFilters(filter).filter((entry) => entry.serializedBytes > maxBytes);
  if (largeArrays.length === 0) return [filter];

  const target = largeArrays.sort((a, b) => b.serializedBytes - a.serializedBytes)[0];
  const pathParts = target.path.replace(/^filter\./, "").split(".");
  const inKey = pathParts[pathParts.length - 1];
  const parentPath = pathParts.slice(0, -1);

  let parent: Record<string, unknown> = filter;
  for (const part of parentPath) {
    const next = parent[part];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      return [filter];
    }
    parent = next as Record<string, unknown>;
  }

  const values = parent[inKey];
  if (!Array.isArray(values)) return [filter];

  const chunks: unknown[][] = [];
  let current: unknown[] = [];
  let currentBytes = 2;

  for (const value of values) {
    const valueBytes = measureSerializedBytes(value);
    if (current.length > 0 && currentBytes + valueBytes + 1 > maxBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(value);
    currentBytes += valueBytes + 1;
  }

  if (current.length > 0) chunks.push(current);
  if (chunks.length <= 1) return [filter];

  return chunks.map((chunk) => {
    const cloned = structuredClone(filter) as Record<string, unknown>;
    let cursor: Record<string, unknown> = cloned;
    for (const part of parentPath) {
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[inKey] = chunk;
    return cloned;
  });
};

export const assertBsonSafeMongoQuery = (input: MongoQueryGuardInput & {
  offendingFilterPath?: string;
}): MongoQueryInstrumentation => {
  const instrumentation = buildMongoQueryInstrumentation(input);
  const resolvedOffendingPath = input.offendingFilterPath ?? instrumentation.offendingFilterPath;

  const forbiddenPaths = findForbiddenFilterObjects(input.filter);
  if (forbiddenPaths.length > 0) {
    throw createSchoolIntelligenceMongoFailureError(new Error("query_payload_too_large"), {
      mongoCollection: input.collection,
      mongoOperation: input.operation,
      queryName: input.pipelineName,
      timeoutMs: input.timeoutMs,
      durationMs: 0,
      documentsReturned: 0,
      querySizeBytes: instrumentation.querySizeBytes,
      pipelineSizeBytes: instrumentation.pipelineSizeBytes,
      arrayLength: instrumentation.arrayLength,
      serializedBytes: instrumentation.serializedBytes,
      limitBytes: BSON_QUERY_SAFE_LIMIT_BYTES,
      offendingFilterPath: forbiddenPaths[0] ?? resolvedOffendingPath,
    });
  }

  const payloadBytes = Math.max(instrumentation.querySizeBytes, instrumentation.pipelineSizeBytes);
  if (payloadBytes > BSON_QUERY_SAFE_LIMIT_BYTES) {
    throw createSchoolIntelligenceMongoFailureError(new Error("query_payload_too_large"), {
      mongoCollection: input.collection,
      mongoOperation: input.operation,
      queryName: input.pipelineName,
      timeoutMs: input.timeoutMs,
      durationMs: 0,
      documentsReturned: 0,
      querySizeBytes: instrumentation.querySizeBytes,
      pipelineSizeBytes: instrumentation.pipelineSizeBytes,
      arrayLength: instrumentation.arrayLength,
      serializedBytes: payloadBytes,
      limitBytes: BSON_QUERY_SAFE_LIMIT_BYTES,
      offendingFilterPath: resolvedOffendingPath,
    });
  }

  return {
    ...instrumentation,
    offendingFilterPath: resolvedOffendingPath,
  };
};

export const logMongoQueryInstrumentation = (
  input: MongoQueryGuardInput & MongoQueryInstrumentation
) => {
  console.info("[MongoProfile] query instrumentation", {
    collection: input.collection,
    operation: input.operation,
    pipelineName: input.pipelineName,
    querySizeBytes: input.querySizeBytes,
    pipelineSizeBytes: input.pipelineSizeBytes,
    idCount: input.idCount,
    projectionFields: input.projectionFields,
    arrayLength: input.arrayLength,
    serializedBytes: input.serializedBytes,
  });
};

export const logLargeArrayFilter = (entry: LargeArrayFilterInfo) => {
  console.warn("[MongoProfile] large array filter", {
    path: entry.path,
    arrayLength: entry.arrayLength,
    serializedBytes: entry.serializedBytes,
  });
};
