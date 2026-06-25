import type { Readable } from "stream";
import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";

export type AwsSdkSendDiagnostics = {
  message: string;
  name?: string;
  stack?: string;
  cause?: unknown;
  causeDetails?: AwsSdkSendDiagnostics;
  metadata?: unknown;
  fault?: unknown;
  retryable?: unknown;
  code?: unknown;
  statusCode?: unknown;
  requestId?: unknown;
  extendedRequestId?: unknown;
  cfRay?: unknown;
};

type AwsSendClient = {
  send: (...args: unknown[]) => Promise<unknown>;
};

export type { AwsSendClient };

type AwsUploadBodyLifecycleTarget = Readable & {
  __drAwsUploadBodyLifecycleAttached?: boolean;
};

export const extractAwsSdkErrorFields = (error: unknown): AwsSdkSendDiagnostics => {
  const record = error as Record<string, unknown>;
  const metadata =
    record.$metadata && typeof record.$metadata === "object"
      ? (record.$metadata as Record<string, unknown>)
      : undefined;

  const cause = error instanceof Error ? error.cause : undefined;
  const causeDetails =
    cause !== undefined && cause !== null
      ? extractAwsSdkErrorFields(cause)
      : undefined;

  return {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : undefined,
    stack: truncateDrErrorStack(error),
    cause,
    causeDetails,
    metadata: record.$metadata,
    fault: record.$fault,
    retryable: record.$retryable,
    code: record.Code ?? record.code,
    statusCode: metadata?.httpStatusCode,
    requestId: metadata?.requestId,
    extendedRequestId: metadata?.extendedRequestId,
    cfRay: metadata?.cfId ?? record.cfRay,
  };
};

export const logAwsSendFailed = (
  command: { constructor: { name: string } },
  provider: string,
  error: unknown,
  extra?: Record<string, unknown>
): void => {
  console.error("[DR] AWS_SEND_FAILED", {
    command: command.constructor.name,
    provider,
    ...extractAwsSdkErrorFields(error),
    ...extra,
  });
};

export const logAwsAbortSignal = (label: string, signal?: AbortSignal | null): void => {
  if (!signal) return;
  console.info("[DR] AWS_ABORT_SIGNAL", {
    label,
    aborted: signal.aborted,
    reason: signal.reason,
  });
};

export const logAwsUploadBodyState = (
  label: string,
  body: Readable,
  extra?: Record<string, unknown>
): void => {
  const stream = body as Readable & { closed?: boolean };
  console.info("[DR] AWS_UPLOAD_BODY_STATE", {
    label,
    readableFlowing: body.readableFlowing,
    destroyed: body.destroyed,
    readableEnded: body.readableEnded,
    closed: stream.closed,
    listenerCountError: body.listenerCount("error"),
    listenerCountData: body.listenerCount("data"),
    listenerCountClose: body.listenerCount("close"),
    listenerCountEnd: body.listenerCount("end"),
    listenerCountReadable: body.listenerCount("readable"),
    ...extra,
  });
};

export const attachAwsUploadBodyLifecycleLogging = (
  body: Readable,
  context: Record<string, unknown> = {}
): void => {
  const target = body as AwsUploadBodyLifecycleTarget;
  if (target.__drAwsUploadBodyLifecycleAttached) return;
  target.__drAwsUploadBodyLifecycleAttached = true;

  const logEvent = (event: string, meta: Record<string, unknown> = {}): void => {
    console.info("[DR] AWS_UPLOAD_BODY_EVENT", { event, ...context, ...meta });
  };

  body.on("error", (error) => {
    logEvent("error", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
    });
  });
  body.on("close", () => logEvent("close"));
  body.on("finish", () => logEvent("finish"));
  body.on("end", () => logEvent("end"));
  body.on("aborted", () => logEvent("aborted"));
  body.on("destroy", () => logEvent("destroy"));
};

export const sendAwsCommandWithDiagnostics = async <T>(
  client: AwsSendClient,
  command: { constructor: { name: string } },
  options?: {
    provider?: string;
    sendOptions?: Record<string, unknown>;
    uploadBody?: Readable;
    abortSignal?: AbortSignal;
  }
): Promise<T> => {
  const provider = options?.provider ?? "r2";
  const abortSignal =
    options?.abortSignal ??
    (options?.sendOptions?.abortSignal as AbortSignal | undefined);

  logAwsAbortSignal("before-send", abortSignal);
  if (options?.uploadBody) {
    logAwsUploadBodyState("before-send", options.uploadBody);
    attachAwsUploadBodyLifecycleLogging(options.uploadBody, {
      provider,
      command: command.constructor.name,
    });
  }

  try {
    const response = await client.send(
      command,
      options?.sendOptions && Object.keys(options.sendOptions).length > 0
        ? options.sendOptions
        : undefined
    );
    return response as T;
  } catch (error) {
    logAwsAbortSignal("send-failed", abortSignal);
    if (options?.uploadBody) {
      logAwsUploadBodyState("send-failed", options.uploadBody);
    }
    logAwsSendFailed(command, provider, error);
    throw error;
  }
};
