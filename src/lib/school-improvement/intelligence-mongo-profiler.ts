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
  saveQuerySnapshot,
} from "@/lib/school-improvement/intelligence-snapshot-store";
import {
  IntelligenceQueryTimeoutError,
  runWithQueryTimeout,
} from "@/lib/school-improvement/intelligence-self-healing";
import { createSchoolIntelligenceMongoFailureError, extractMongoFailureContext, mergeQuerySourceIntoMongoContext, mergeSerializationTraceIntoMongoContext } from "@/lib/school-intelligence/school-intelligence-root-cause-capture";
import {
  assertBsonSafeMongoQuery,
  BSON_IN_BATCH_COUNT,
  findLargeArrayFilters,
  logLargeArrayFilter,
  logMongoQueryInstrumentation,
  resolveFilterChunks,
  sanitizeMongoFilter,
  shouldAutoChunkFilter,
} from "@/lib/school-intelligence/school-intelligence-bson-safety";
import {
  buildBsonSerializationTrace,
  type SchoolIntelligenceBsonSerializationTrace,
} from "@/lib/school-intelligence/school-intelligence-bson-serialization-trace";
import {
  buildQuerySourceTrace,
  type SchoolIntelligenceQuerySourceEntry,
} from "@/lib/school-intelligence/school-intelligence-query-source-trace";
import {
  getSchoolIntelligenceBuildTrace,
  recordSchoolIntelligenceBsonSerializationTrace,
  recordSchoolIntelligenceChunkRecovery,
  recordSchoolIntelligenceQuerySource,
} from "@/lib/school-intelligence/school-intelligence-section-tracer";

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

const enrichMongoFailure = (
  error: unknown,
  trace: SchoolIntelligenceQuerySourceEntry | undefined,
  context: Parameters<typeof createSchoolIntelligenceMongoFailureError>[1],
  serializationTrace?: SchoolIntelligenceBsonSerializationTrace
) => {
  const existing = extractMongoFailureContext(error);
  const base = { ...context, ...existing };
  const withSource = trace ? mergeQuerySourceIntoMongoContext(base, trace) : base;
  const merged = serializationTrace
    ? mergeSerializationTraceIntoMongoContext(withSource, serializationTrace)
    : withSource;
  return createSchoolIntelligenceMongoFailureError(error, merged);
};

const captureBsonSerializationTrace = (input: {
  queryName: string;
  collection: string;
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  pipeline?: unknown[];
  options?: unknown;
  populate?: unknown;
}): SchoolIntelligenceBsonSerializationTrace => {
  const trace = buildBsonSerializationTrace(input);
  recordSchoolIntelligenceBsonSerializationTrace(trace);
  console.info("[MongoProfile] BSON serialization trace", {
    queryName: trace.queryName,
    collection: trace.collection,
    filterBytes: trace.filterBytes,
    projectionBytes: trace.projectionBytes,
    optionsBytes: trace.optionsBytes,
    populateBytes: trace.populateBytes,
    pipelineBytes: trace.pipelineBytes,
    serializationBreakdown: trace.serializationBreakdown,
    offendingComponent: trace.offendingComponent,
  });
  return trace;
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
  sourceVariableName?: string;
  sourceFunction?: string;
  options?: unknown;
  populate?: unknown;
  pagedFind?: {
    batchSize: number;
    maxDocuments?: number;
    runPage: (skip: number, limit: number) => Promise<T>;
    buildPageOptions?: (skip: number, limit: number) => Record<string, unknown>;
  };
}): Promise<T> => {
  const queryName = input.pipelineName || input.operation;
  const sanitizedFilter =
    input.filter && typeof input.filter === "object" && !Array.isArray(input.filter)
      ? sanitizeMongoFilter(input.filter as Record<string, unknown>)
      : input.filter;
  let querySourceTrace: SchoolIntelligenceQuerySourceEntry | undefined;
  let lastSerializationTrace = captureBsonSerializationTrace({
    queryName,
    collection: input.collection,
    filter: sanitizedFilter,
    projection: input.projection,
    pipeline: input.pipeline,
    options: input.options,
    populate: input.populate,
  });

  if (input.sourceVariableName && input.sourceFunction) {
    querySourceTrace = buildQuerySourceTrace({
      queryName,
      collection: input.collection,
      filter: sanitizedFilter,
      projection: input.projection,
      pipeline: input.pipeline,
      sourceVariableName: input.sourceVariableName,
      sourceFunction: input.sourceFunction,
    });
    recordSchoolIntelligenceQuerySource(querySourceTrace);
    console.info("[MongoProfile] query source trace", {
      queryName: querySourceTrace.queryName,
      collection: querySourceTrace.collection,
      filterKeys: querySourceTrace.filterKeys,
      projectionKeys: querySourceTrace.projectionKeys,
      sourceVariableName: querySourceTrace.sourceVariableName,
      sourceFunction: querySourceTrace.sourceFunction,
      totalSerializedBytes: querySourceTrace.totalSerializedBytes,
      offendingFilterPath: querySourceTrace.offendingFilterPath,
      fieldBytes: querySourceTrace.fieldBytes,
      inArrayAnalysis: querySourceTrace.inArrayAnalysis,
    });
  }

  if (input.pagedFind) {
    const chunkStarted = Date.now();
    const merged: unknown[] = [];
    let skip = 0;
    let chunkCount = 0;
    const { batchSize, maxDocuments, runPage } = input.pagedFind;

    while (merged.length < (maxDocuments ?? Number.MAX_SAFE_INTEGER)) {
      const remaining = maxDocuments != null ? maxDocuments - merged.length : batchSize;
      const pageLimit = Math.min(batchSize, remaining);
      lastSerializationTrace = captureBsonSerializationTrace({
        queryName: `${queryName}.page.${chunkCount + 1}`,
        collection: input.collection,
        filter: sanitizedFilter,
        projection: input.projection,
        pipeline: input.pipeline,
        options: {
          ...(input.options && typeof input.options === "object" ? input.options : {}),
          ...(input.pagedFind.buildPageOptions?.(skip, pageLimit) ?? { skip, limit: pageLimit }),
        },
        populate: input.populate,
      });
      const batch = await runWithQueryTimeout(
        () => runPage(skip, pageLimit),
        input.timeoutMs,
        `${input.collection}.${queryName}.page.${chunkCount + 1}`
      );
      const rows = Array.isArray(batch) ? batch : [batch];
      if (rows.length === 0) break;
      merged.push(...rows);
      skip += rows.length;
      chunkCount += 1;
      if (rows.length < pageLimit) break;
    }

    recordSchoolIntelligenceChunkRecovery({
      queryName,
      collection: input.collection,
      chunkCount,
      chunkSize: batchSize,
      chunkExecutionMs: Date.now() - chunkStarted,
      chunkedRecoveryUsed: true,
    });

    return merged as T;
  }

  if (sanitizedFilter !== undefined || input.pipeline !== undefined) {
    let instrumentation;
    const filterRecord =
      sanitizedFilter && typeof sanitizedFilter === "object" && !Array.isArray(sanitizedFilter)
        ? (sanitizedFilter as Record<string, unknown>)
        : undefined;
    const resolvedChunks =
      filterRecord && input.createFilterFn ? resolveFilterChunks(filterRecord) : null;
    const canAutoChunk =
      Boolean(filterRecord && input.createFilterFn) &&
      Boolean(resolvedChunks?.chunkedRecoveryUsed || (filterRecord && shouldAutoChunkFilter(filterRecord)));

    if (canAutoChunk && filterRecord && input.createFilterFn && resolvedChunks && resolvedChunks.chunks.length > 1) {
      const chunkStarted = Date.now();
      const results = await Promise.allSettled(
        resolvedChunks.chunks.map((chunk, chunkIndex) => {
          lastSerializationTrace = captureBsonSerializationTrace({
            queryName: `${queryName}.chunk.${chunkIndex + 1}`,
            collection: input.collection,
            filter: chunk,
            projection: input.projection,
            pipeline: input.pipeline,
            options: input.options,
            populate: input.populate,
          });
          return runWithQueryTimeout(
            input.createFilterFn!(chunk),
            input.timeoutMs,
            `${input.collection}.${queryName}.chunk`
          );
        })
      );
      const fulfilled: T[] = [];
      const rejected: PromiseRejectedResult[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          fulfilled.push(result.value);
        } else {
          rejected.push(result);
        }
      }

      recordSchoolIntelligenceChunkRecovery({
        queryName,
        collection: input.collection,
        chunkCount: resolvedChunks.chunks.length,
        chunkSize: resolvedChunks.chunkSize || BSON_IN_BATCH_COUNT,
        chunkExecutionMs: Date.now() - chunkStarted,
        chunkedRecoveryUsed: true,
      });

      if (fulfilled.length === 0) {
        throw rejected[0]?.reason ?? new Error("query_payload_too_large");
      }
      if (rejected.length > 0) {
        console.warn("[MongoProfile] partial chunk failure", {
          queryName,
          collection: input.collection,
          failedChunks: rejected.length,
          succeededChunks: fulfilled.length,
        });
      }
      return mergeArrayResults(fulfilled);
    }

    try {
      instrumentation = assertBsonSafeMongoQuery({
        collection: input.collection,
        operation: input.operation,
        pipelineName: input.pipelineName,
        filter: sanitizedFilter,
        projection: input.projection,
        pipeline: input.pipeline,
        timeoutMs: input.timeoutMs,
        offendingFilterPath: querySourceTrace?.offendingFilterPath,
      });
    } catch (error) {
      if (querySourceTrace) {
        throw enrichMongoFailure(
          error,
          querySourceTrace,
          {
            mongoCollection: input.collection,
            mongoOperation: input.operation,
            queryName: input.pipelineName,
            timeoutMs: input.timeoutMs,
            durationMs: 0,
            documentsReturned: 0,
          },
          lastSerializationTrace
        );
      }
      throw error;
    }
    logMongoQueryInstrumentation({
      collection: input.collection,
      operation: input.operation,
      pipelineName: input.pipelineName,
      timeoutMs: input.timeoutMs,
      filter: sanitizedFilter,
      projection: input.projection,
      pipeline: input.pipeline,
      ...instrumentation,
    });

    for (const entry of findLargeArrayFilters(sanitizedFilter)) {
      logLargeArrayFilter(entry);
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
  sourceVariableName?: string;
  sourceFunction?: string;
  options?: unknown;
  populate?: unknown;
  pagedFind?: {
    batchSize: number;
    maxDocuments?: number;
    runPage: (skip: number, limit: number) => Promise<T>;
    buildPageOptions?: (skip: number, limit: number) => Record<string, unknown>;
  };
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
      sourceVariableName: input.sourceVariableName,
      sourceFunction: input.sourceFunction,
      options: input.options,
      populate: input.populate,
      pagedFind: input.pagedFind,
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
    await saveQuerySnapshot({
      key: snapshotKey,
      domain,
      payload: result,
      collection: input.collection,
      queryName: input.pipelineName || input.operation,
      executionMs: durationMs,
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
    const latestSerializationTrace =
      getSchoolIntelligenceBuildTrace().bsonSerializationTraces?.at(-1);
    throw enrichMongoFailure(
      error,
      undefined,
      {
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
        filterKeys: existingMongo?.filterKeys,
        projectionKeys: existingMongo?.projectionKeys,
        sourceVariableName: existingMongo?.sourceVariableName,
        sourceFunction: existingMongo?.sourceFunction,
        uniqueValues: existingMongo?.uniqueValues,
        duplicateValues: existingMongo?.duplicateValues,
        firstFiveValues: existingMongo?.firstFiveValues,
        lastFiveValues: existingMongo?.lastFiveValues,
        totalSerializedBytes: existingMongo?.totalSerializedBytes,
        fieldBytes: existingMongo?.fieldBytes,
      },
      latestSerializationTrace
    );
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
    sourceVariableName?: string;
    sourceFunction?: string;
    options?: unknown;
    populate?: unknown;
    pagedFind?: {
      batchSize: number;
      maxDocuments?: number;
      runPage: (skip: number, limit: number) => Promise<T>;
      buildPageOptions?: (skip: number, limit: number) => Record<string, unknown>;
    };
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
    sourceVariableName: input.sourceVariableName,
    sourceFunction: input.sourceFunction,
    options: input.options,
    populate: input.populate,
    pagedFind: input.pagedFind,
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
    sourceVariableName?: string;
    sourceFunction?: string;
    options?: unknown;
    populate?: unknown;
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
    sourceVariableName: input.sourceVariableName,
    sourceFunction: input.sourceFunction,
    options: input.options,
    populate: input.populate,
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
