import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  AggregationFailureReport,
  ModelValidationIssue,
  MongoQueryProfile,
} from "@/lib/school-improvement/intelligence-diagnostics-types";

export type IntelligenceDiagnosticsStore = {
  mongoQueries: MongoQueryProfile[];
  aggregationFailures: AggregationFailureReport[];
  modelIssues: ModelValidationIssue[];
};

const storage = new AsyncLocalStorage<IntelligenceDiagnosticsStore>();

export const createIntelligenceDiagnosticsStore = (): IntelligenceDiagnosticsStore => ({
  mongoQueries: [],
  aggregationFailures: [],
  modelIssues: [],
});

export const getIntelligenceDiagnosticsContext = (): IntelligenceDiagnosticsStore | undefined =>
  storage.getStore();

export const runWithIntelligenceDiagnostics = async <T>(fn: () => Promise<T>): Promise<T> => {
  const store = createIntelligenceDiagnosticsStore();
  return storage.run(store, fn);
};

export const recordMongoQuery = (entry: MongoQueryProfile): void => {
  const store = storage.getStore();
  if (!store) return;
  store.mongoQueries.push(entry);
};

export const recordAggregationFailure = (entry: AggregationFailureReport): void => {
  const store = storage.getStore();
  if (!store) return;
  store.aggregationFailures.push(entry);
  console.error("[AggregationFailure]", {
    pipeline: entry.pipelineName,
    collection: entry.collection,
    stage: entry.stageIndex,
    error: entry.error,
  });
};

export const recordModelIssue = (entry: ModelValidationIssue): void => {
  const store = storage.getStore();
  if (!store) return;
  store.modelIssues.push(entry);
};
