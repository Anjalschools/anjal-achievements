export type SchoolIntelligenceFailureClassification =
  | "Mongo Timeout"
  | "Mongo Aggregation Failure"
  | "Missing Snapshot"
  | "Undefined Reference"
  | "Import Failure"
  | "Environment Failure"
  | "Query Payload Too Large"
  | "Unknown Failure";

export type SchoolIntelligenceMongoFailureContext = {
  mongoCollection: string;
  mongoOperation: string;
  queryName?: string;
  timeoutMs: number;
  durationMs: number;
  documentsReturned?: number;
  querySizeBytes?: number;
  pipelineSizeBytes?: number;
  arrayLength?: number;
  serializedBytes?: number;
  limitBytes?: number;
  offendingFilterPath?: string;
};

export class SchoolIntelligenceMongoFailureError extends Error {
  readonly mongoContext: SchoolIntelligenceMongoFailureContext;

  constructor(cause: unknown, context: SchoolIntelligenceMongoFailureContext) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(message);
    this.name = cause instanceof Error ? cause.name : "Error";
    this.mongoContext = context;
    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }
}

export const createSchoolIntelligenceMongoFailureError = (
  cause: unknown,
  context: SchoolIntelligenceMongoFailureContext
) => new SchoolIntelligenceMongoFailureError(cause, context);

export const extractMongoFailureContext = (
  error: unknown
): SchoolIntelligenceMongoFailureContext | undefined => {
  if (error instanceof SchoolIntelligenceMongoFailureError) {
    return error.mongoContext;
  }
  return undefined;
};

export const classifySchoolIntelligenceFailure = (input: {
  error?: unknown;
  errorName?: string;
  errorMessage?: string;
  mongoOperation?: string;
  queryName?: string;
}): SchoolIntelligenceFailureClassification => {
  const errorName = input.errorName ?? (input.error instanceof Error ? input.error.name : "");
  const message = `${input.errorMessage ?? ""} ${input.error instanceof Error ? input.error.message : ""}`.toLowerCase();

  if (
    message.includes("query_payload_too_large") ||
    errorName === "RangeError" ||
    message.includes("err_out_of_range") ||
    message.includes("offset") && message.includes("out of range")
  ) {
    return "Query Payload Too Large";
  }

  if (
    errorName.includes("IntelligenceQueryTimeout") ||
    message.includes("exceeded") ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return "Mongo Timeout";
  }

  if (
    input.mongoOperation === "aggregate" ||
    Boolean(input.queryName) ||
    message.includes("aggregation") ||
    message.includes("$facet") ||
    message.includes("pipeline")
  ) {
    return "Mongo Aggregation Failure";
  }

  if (message.includes("snapshot") && (message.includes("missing") || message.includes("miss"))) {
    return "Missing Snapshot";
  }

  if (
    errorName === "TypeError" ||
    message.includes("is not defined") ||
    message.includes("cannot read propert") ||
    message.includes("undefined")
  ) {
    return "Undefined Reference";
  }

  if (
    message.includes("cannot find module") ||
    message.includes("module_not_found") ||
    message.includes("failed to resolve import")
  ) {
    return "Import Failure";
  }

  if (
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("connection") ||
    message.includes("environment") ||
    message.includes("mongodb") && message.includes("connect")
  ) {
    return "Environment Failure";
  }

  return "Unknown Failure";
};

export type SchoolIntelligenceFirstFailureRecord = {
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
  querySizeBytes?: number;
  pipelineSizeBytes?: number;
  arrayLength?: number;
  serializedBytes?: number;
  limitBytes?: number;
  offendingFilterPath?: string;
  failureClassification: SchoolIntelligenceFailureClassification;
};

export const buildFirstFailureRecord = (input: {
  section: string;
  service: string;
  error: unknown;
  durationMs: number;
  timestamp?: string;
}): SchoolIntelligenceFirstFailureRecord => {
  const mongo = extractMongoFailureContext(input.error);
  const errorName = input.error instanceof Error ? input.error.name : "Error";
  const errorMessage = input.error instanceof Error ? input.error.message : String(input.error);
  const stack = input.error instanceof Error ? input.error.stack : undefined;

  return {
    section: input.section,
    service: input.service,
    errorName,
    errorMessage,
    stack,
    timestamp: input.timestamp ?? new Date().toISOString(),
    durationMs: input.durationMs,
    mongoCollection: mongo?.mongoCollection,
    mongoOperation: mongo?.mongoOperation,
    queryName: mongo?.queryName,
    timeoutMs: mongo?.timeoutMs,
    documentsReturned: mongo?.documentsReturned,
    querySizeBytes: mongo?.querySizeBytes,
    pipelineSizeBytes: mongo?.pipelineSizeBytes,
    arrayLength: mongo?.arrayLength,
    serializedBytes: mongo?.serializedBytes,
    limitBytes: mongo?.limitBytes,
    offendingFilterPath: mongo?.offendingFilterPath,
    failureClassification: classifySchoolIntelligenceFailure({
      error: input.error,
      errorName,
      errorMessage,
      mongoOperation: mongo?.mongoOperation,
      queryName: mongo?.queryName,
    }),
  };
};
