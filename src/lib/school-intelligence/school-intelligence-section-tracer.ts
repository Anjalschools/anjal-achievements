import { AsyncLocalStorage } from "node:async_hooks";
import {
  buildFirstFailureRecord,
  type SchoolIntelligenceFirstFailureRecord,
} from "@/lib/school-intelligence/school-intelligence-root-cause-capture";
import type { SchoolIntelligenceQuerySourceEntry } from "@/lib/school-intelligence/school-intelligence-query-source-trace";
import type { SchoolIntelligenceChunkRecoveryDiagnostics } from "@/lib/school-intelligence/school-intelligence-bson-safety";
import type { SchoolIntelligenceBsonSerializationTrace } from "@/lib/school-intelligence/school-intelligence-bson-serialization-trace";

export type SchoolIntelligenceFirstFailure = SchoolIntelligenceFirstFailureRecord;

export type SchoolIntelligenceSnapshotSaveTrace = {
  attempted: boolean;
  succeeded: boolean;
  errorName?: string;
  errorMessage?: string;
  timestamp?: string;
};

type SchoolIntelligenceBuildTraceStore = {
  firstFailure?: SchoolIntelligenceFirstFailure;
  snapshotSave?: SchoolIntelligenceSnapshotSaveTrace;
  querySourceMap?: SchoolIntelligenceQuerySourceEntry[];
  chunkRecovery?: SchoolIntelligenceChunkRecoveryDiagnostics[];
  bsonSerializationTraces?: SchoolIntelligenceBsonSerializationTrace[];
};

const storage = new AsyncLocalStorage<SchoolIntelligenceBuildTraceStore>();

export const runWithSchoolIntelligenceBuildTrace = async <T>(fn: () => Promise<T>): Promise<T> =>
  storage.run(
    {
      snapshotSave: { attempted: false, succeeded: false },
      querySourceMap: [],
      chunkRecovery: [],
      bsonSerializationTraces: [],
    },
    fn
  );

export const getSchoolIntelligenceBuildTrace = (): SchoolIntelligenceBuildTraceStore =>
  storage.getStore() ?? {};

export const recordSchoolIntelligenceFirstFailure = (failure: SchoolIntelligenceFirstFailure) => {
  const store = storage.getStore();
  if (!store || store.firstFailure) return;
  store.firstFailure = failure;
};

export const recordSchoolIntelligenceQuerySource = (entry: SchoolIntelligenceQuerySourceEntry) => {
  const store = storage.getStore();
  if (!store) return;
  if (!store.querySourceMap) store.querySourceMap = [];
  store.querySourceMap.push(entry);
};

export const recordSchoolIntelligenceChunkRecovery = (
  entry: SchoolIntelligenceChunkRecoveryDiagnostics
) => {
  const store = storage.getStore();
  if (!store) return;
  if (!store.chunkRecovery) store.chunkRecovery = [];
  store.chunkRecovery.push(entry);
};

export const recordSchoolIntelligenceBsonSerializationTrace = (
  entry: SchoolIntelligenceBsonSerializationTrace
) => {
  const store = storage.getStore();
  if (!store) return;
  if (!store.bsonSerializationTraces) store.bsonSerializationTraces = [];
  store.bsonSerializationTraces.push(entry);
};

const logSectionFailed = (
  section: string,
  service: string,
  started: number,
  error: unknown
): never => {
  const durationMs = Date.now() - started;
  const failure = buildFirstFailureRecord({
    section,
    service,
    error,
    durationMs,
  });

  console.error("[SchoolIntelligence Section Failed]", {
    section: failure.section,
    durationMs: failure.durationMs,
    errorName: failure.errorName,
    errorMessage: failure.errorMessage,
    stack: failure.stack,
    mongoCollection: failure.mongoCollection,
    mongoOperation: failure.mongoOperation,
    queryName: failure.queryName,
    failureClassification: failure.failureClassification,
  });

  recordSchoolIntelligenceFirstFailure(failure);
  throw error;
};

export const traceSchoolIntelligenceSection = async <T>(
  section: string,
  service: string,
  fn: () => Promise<T>
): Promise<T> => {
  const started = Date.now();
  const timestamp = new Date().toISOString();
  console.info("[SchoolIntelligence Section Start]", { section, timestamp });

  try {
    const result = await fn();
    console.info("[SchoolIntelligence Section Success]", {
      section,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    return logSectionFailed(section, service, started, error);
  }
};

export const traceSchoolIntelligenceSectionSync = <T>(
  section: string,
  service: string,
  fn: () => T
): T => {
  const started = Date.now();
  const timestamp = new Date().toISOString();
  console.info("[SchoolIntelligence Section Start]", { section, timestamp });

  try {
    const result = fn();
    console.info("[SchoolIntelligence Section Success]", {
      section,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    return logSectionFailed(section, service, started, error);
  }
};

export const traceSchoolIntelligenceSnapshotSave = async (
  logicalKey: string,
  fn: () => Promise<void>
) => {
  const resolvedKey = `full_payload:${logicalKey}`;
  const store = storage.getStore();
  const timestamp = new Date().toISOString();

  console.info("[SchoolIntelligence Snapshot Save Attempt]", { key: resolvedKey, timestamp });
  if (store) {
    store.snapshotSave = { attempted: true, succeeded: false, timestamp };
  }

  try {
    await fn();
    console.info("[SchoolIntelligence Snapshot Save Success]", { key: resolvedKey });
    if (store) {
      store.snapshotSave = { attempted: true, succeeded: true, timestamp: new Date().toISOString() };
    }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "Error";
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SchoolIntelligence Snapshot Save Failure]", {
      key: resolvedKey,
      errorName,
      errorMessage,
    });
    if (store) {
      store.snapshotSave = {
        attempted: true,
        succeeded: false,
        errorName,
        errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
