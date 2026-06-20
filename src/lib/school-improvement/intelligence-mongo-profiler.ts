import "server-only";
import type mongoose from "mongoose";
import {
  recordAggregationFailure,
  recordMongoQuery,
} from "@/lib/school-improvement/intelligence-diagnostics-context";
import { recordIntelligenceRecoveryEvent } from "@/lib/school-improvement/intelligence-recovery-events";
import { resolveQueryDomain } from "@/lib/school-improvement/intelligence-service-isolation";
import {
  loadIntelligenceSnapshot,
  saveIntelligenceSnapshot,
} from "@/lib/school-improvement/intelligence-snapshot-store";
import {
  IntelligenceQueryTimeoutError,
  runWithQueryTimeout,
} from "@/lib/school-improvement/intelligence-self-healing";
import { createSchoolIntelligenceMongoFailureError, extractMongoFailureContext } from "@/lib/school-intelligence/school-intelligence-root-cause-capture";
import {
  assertBsonSafeMongoQuery,
  BSON_IN_ARRAY_CHUNK_BYTES,
  findLargeArrayFilters,
  logLargeArrayFilter,
  logMongoQueryInstrumentation,
  splitFilterByInArraySize,
} from "@/lib/school-intelligence/school-intelligence-bson-safety";

const SLOW_QUERY_MS = 3000;
const QUERY_TIMEOUT_MS = Number(process.env.INTELLIGENCE_QUERY_TIMEOUT_MS || 8000);

const estimateDocumentsReturned = (result: unknown): number => {
  if (result == null) return 0;
  if (Array.isArray(result)) return result.length;
  if (typeof result === "number") return result;
  if (typeof result === "object" && "length" in result && typeof (result as { length: unknown }).length === "number") {
    return Number((result as { length: number }).length);
  }
  return 1;
};

export const parseAggregationStageIndex = (error: unknown): number | undefined => {
  const message = error instanceof Error ? error.message : String(error);
  const stageMatch = message.match(/stage\s+(\d+)/i) || message.match(/at stage (\d+)/i);
  if (stageMatch?.[1]) return Number(stageMatch[1]);
  const pipelineMatch = message.match(/pipeline\[(\d+)\]/i);
  if (pipelineMatch?.[1]) return Number(pipelineMatch[1]);
  return undefined;
};

const querySnapshotKey = (collection: string, operation: string, pipelineName?: string) =>
  `${collection}:${pipelineName || operation}`;

const mergeArrayResults = <T>(parts: T[]): T => {
  if (parts.length === 0) return [] as T;
  if (Array.isArray(parts[0])) {
    return parts.flatMap((part) => part as unknown[]) as T;
  }
  return parts[parts.length - 1];
};

const runGuardedMongoQuery = async <T>(input: {
  collection: string;
  operation: string;
  pipelineName?: string;
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  pipeline?: unknown[];
  timeoutMs: number;
  fn: () => Promise<T>;
  createFilterFn?: (filter: Record<string, unknown>) => () => Promise<T>;
}): Promise<T> => {
  if (input.filter !== undefined || input.pipeline !== undefined) {
    const instrumentation = assertBsonSafeMongoQuery({
      collection: input.collection,
      operation: input.operation,
      pipelineName: input.pipelineName,
      filter: input.filter,
      projection: input.projection,
      pipeline: input.pipeline,
      timeoutMs: input.timeoutMs,
    });
    logMongoQueryInstrumentation({
      collection: input.collection,
      operation: input.operation,
      pipelineName: input.pipelineName,
      timeoutMs: input.timeoutMs,
      filter: input.filter,
      projection: input.projection,
      pipeline: input.pipeline,
      ...instrumentation,
    });

    for (const entry of findLargeArrayFilters(input.filter)) {
      logLargeArrayFilter(entry);
    }

    if (
      input.filter &&
      input.createFilterFn &&
      typeof input.filter === "object" &&
      !Array.isArray(input.filter)
    ) {
      const chunks = splitFilterByInArraySize(
        input.filter as Record<string, unknown>,
        BSON_IN_ARRAY_CHUNK_BYTES
      );
      if (chunks.length > 1) {
        const parts = await Promise.all(
          chunks.map((chunk) =>
            runWithQueryTimeout(
              input.createFilterFn!(chunk),
              input.timeoutMs,
              `${input.collection}.${input.pipelineName || input.operation}`
            )
          )
        );
        return mergeArrayResults(parts);
      }
    }
  }

  return runWithQueryTimeout(
    input.fn,
    input.timeoutMs,
    `${input.collection}.${input.pipelineName || input.operation}`
  );
};

export const profileMongoOperation = async <T>(input: {
  collection: string;
  operation: string;
  pipelineName?: string;
  fn: () => Promise<T>;
  countDocuments?: (result: T) => number;
  timeoutMs?: number;
  /** When true, return cached snapshot on any failure (not only timeout). */
  snapshotOnFailure?: boolean;
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  pipeline?: unknown[];
  createFilterFn?: (filter: Record<string, unknown>) => () => Promise<T>;
}): Promise<T> => {
  const started = Date.now();
  const domain = resolveQueryDomain(input.collection);
  const snapshotKey = querySnapshotKey(input.collection, input.operation, input.pipelineName);
  const timeoutMs = input.timeoutMs ?? QUERY_TIMEOUT_MS;

  try {
    const result = await runGuardedMongoQuery({
      collection: input.collection,
      operation: input.operation,
      pipelineName: input.pipelineName,
      filter: input.filter,
      projection: input.projection,
      pipeline: input.pipeline,
      timeoutMs,
      fn: input.fn,
      createFilterFn: input.createFilterFn,
    });
    const durationMs = Date.now() - started;
    const documentsReturned = input.countDocuments?.(result) ?? estimateDocumentsReturned(result);
    const slow = durationMs > SLOW_QUERY_MS;
    recordMongoQuery({
      collection: input.collection,
      operation: input.operation,
      pipelineName: input.pipelineName,
      durationMs,
      documentsReturned,
      slow,
    });
    await saveIntelligenceSnapshot({
      key: snapshotKey,
      domain,
      kind: "query",
      payload: result,
    });
    if (slow) {
      console.warn("[MongoProfile] slow query", {
        collection: input.collection,
        operation: input.operation,
        pipelineName: input.pipelineName,
        durationMs,
        documentsReturned,
      });
    }
    return result;
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof IntelligenceQueryTimeoutError;
    const existingMongo = extractMongoFailureContext(error);
    const isPayloadTooLarge = message === "query_payload_too_large";

    if (input.pipelineName || input.operation.includes("aggregate")) {
      recordAggregationFailure({
        pipelineName: input.pipelineName || input.operation,
        collection: input.collection,
        error: message,
        stageIndex: parseAggregationStageIndex(error),
      });
    }

    const cached = await loadIntelligenceSnapshot<T>(snapshotKey, "query");
    if (cached != null && !isPayloadTooLarge && (isTimeout || input.snapshotOnFailure)) {
      recordMongoQuery({
        collection: input.collection,
        operation: input.operation,
        pipelineName: input.pipelineName,
        durationMs,
        documentsReturned: input.countDocuments?.(cached) ?? estimateDocumentsReturned(cached),
        slow: true,
      });
      await recordIntelligenceRecoveryEvent({
        domain,
        service: input.collection,
        outcome: "query_degraded",
        retryCount: 0,
        recoveredAfterRetry: false,
        snapshotFallback: true,
        durationMs,
        message,
      });
      console.warn("[MongoProfile] query timeout — serving cached snapshot", {
        snapshotKey,
        timeoutSource: `${input.collection}.${input.pipelineName || input.operation}`,
        durationMs,
        documentsReturned: input.countDocuments?.(cached) ?? estimateDocumentsReturned(cached),
      });
      return cached;
    }

    console.error("[MongoProfile] query failed", {
      collection: input.collection,
      operation: input.operation,
      pipelineName: input.pipelineName,
      timeoutSource: isTimeout ? `${input.collection}.${input.pipelineName || input.operation}` : undefined,
      durationMs,
      message,
    });
    throw createSchoolIntelligenceMongoFailureError(error, {
      mongoCollection: input.collection,
      mongoOperation: input.operation,
      queryName: input.pipelineName,
      timeoutMs,
      durationMs,
      documentsReturned: 0,
      querySizeBytes: existingMongo?.querySizeBytes,
      pipelineSizeBytes: existingMongo?.pipelineSizeBytes,
      arrayLength: existingMongo?.arrayLength,
      serializedBytes: existingMongo?.serializedBytes,
      limitBytes: existingMongo?.limitBytes,
      offendingFilterPath: existingMongo?.offendingFilterPath,
    });
  }
};

export const profileMongoFind = async <T>(
  model: mongoose.Model<unknown>,
  input: {
    operation: string;
    fn: () => Promise<T>;
    countDocuments?: (result: T) => number;
    timeoutMs?: number;
    snapshotOnFailure?: boolean;
    filter?: unknown;
    projection?: string | Record<string, unknown>;
    createFilterFn?: (filter: Record<string, unknown>) => () => Promise<T>;
  }
): Promise<T> =>
  profileMongoOperation({
    collection: model.collection.name,
    operation: input.operation,
    fn: input.fn,
    countDocuments: input.countDocuments,
    timeoutMs: input.timeoutMs,
    snapshotOnFailure: input.snapshotOnFailure,
    filter: input.filter,
    projection: input.projection,
    createFilterFn: input.createFilterFn,
  });

export const profileMongoAggregate = async <T>(
  model: mongoose.Model<unknown>,
  input: {
    pipelineName: string;
    fn: () => Promise<T>;
    countDocuments?: (result: T) => number;
    timeoutMs?: number;
    snapshotOnFailure?: boolean;
    pipeline?: unknown[];
  }
): Promise<T> =>
  profileMongoOperation({
    collection: model.collection.name,
    operation: "aggregate",
    pipelineName: input.pipelineName,
    fn: input.fn,
    countDocuments: input.countDocuments,
    timeoutMs: input.timeoutMs,
    snapshotOnFailure: input.snapshotOnFailure,
    pipeline: input.pipeline,
  });

export const profileMongoCount = async (
  model: mongoose.Model<unknown>,
  input: {
    operation: string;
    fn: () => Promise<number>;
  }
): Promise<number> =>
  profileMongoOperation({
    collection: model.collection.name,
    operation: input.operation,
    fn: input.fn,
    countDocuments: (n) => n,
  });
