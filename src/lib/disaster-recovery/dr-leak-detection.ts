import { AsyncResource, createHook, type asyncHooks } from "node:async_hooks";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { Readable } from "node:stream";
import {
  getOpenDrStreams,
  getPendingDrPromises,
} from "@/lib/disaster-recovery/dr-verification";

type ProcessWithInternals = NodeJS.Process & {
  _getActiveHandles?: () => unknown[];
  _getActiveRequests?: () => unknown[];
};

type DrAsyncResourceEntry = {
  resourceId: number;
  triggerAsyncId: number;
  type: string;
  createdAt: number;
  destroyedAt?: number;
  stack?: string;
};

type DrTimerEntry = {
  id: ReturnType<typeof setTimeout>;
  kind: "timeout" | "interval" | "immediate";
  createdAt: number;
  stack: string;
  cleared: boolean;
};

type DrArchiverDiagnostics = {
  archivePointer: number;
  archiveAborted?: boolean;
  archiveDestroyed?: boolean;
  archiveReadableEnded?: boolean;
  archiveListeners?: Record<string, number>;
  outputDestroyed?: boolean;
  outputReadableEnded?: boolean;
  outputWritableFinished?: boolean;
  outputClosed?: boolean;
  outputListeners?: Record<string, number>;
};

type DrR2UploadDiagnostics = {
  bodyStreamDestroyed?: boolean;
  bodyStreamReadableEnded?: boolean;
  bodyStreamClosed?: boolean;
  uploadCompleted: boolean;
};

type DrLeakSession = {
  active: boolean;
  handleObjectKeys: Map<object, string>;
  handleStacks: Map<object, string>;
  asyncResources: Map<number, DrAsyncResourceEntry>;
  timers: Map<unknown, DrTimerEntry>;
  archiverDiagnostics?: () => DrArchiverDiagnostics;
  r2UploadDiagnostics?: () => DrR2UploadDiagnostics;
  asyncHook?: asyncHooks.Hook;
  originalSetTimeout?: typeof setTimeout;
  originalSetInterval?: typeof setInterval;
  originalSetImmediate?: typeof setImmediate;
  baselineHandleCount: number;
  baselineRequestCount: number;
};

const createEmptyLeakSession = (): DrLeakSession => ({
  active: false,
  handleObjectKeys: new Map(),
  handleStacks: new Map(),
  asyncResources: new Map(),
  timers: new Map(),
  baselineHandleCount: 0,
  baselineRequestCount: 0,
});

let session: DrLeakSession = createEmptyLeakSession();

const captureStack = (): string => new Error().stack || "unknown";

const isMongoPersistentHandle = (handle: unknown): boolean => {
  if (!handle || typeof handle !== "object") return false;
  const name = handle.constructor?.name ?? "";
  if (/mongo/i.test(name)) return true;
  if (name === "Socket" || name === "TLSSocket") {
    const socket = handle as net.Socket;
    if (socket.remotePort === 27017) return true;
    const remote = String(socket.remoteAddress || "");
    if (remote.includes("mongodb") || remote.endsWith(":27017")) return true;
  }
  return false;
};

const getActiveHandles = (): unknown[] => {
  const proc = process as ProcessWithInternals;
  return typeof proc._getActiveHandles === "function" ? proc._getActiveHandles() : [];
};

const getActiveRequests = (): unknown[] => {
  const proc = process as ProcessWithInternals;
  return typeof proc._getActiveRequests === "function" ? proc._getActiveRequests() : [];
};

const describeHandle = (handle: unknown): Record<string, unknown> => {
  if (!handle || typeof handle !== "object") {
    return { type: typeof handle };
  }

  const obj = handle as Record<string, unknown>;
  const constructorName = handle.constructor?.name ?? "Unknown";
  const objectKey = session.handleObjectKeys.get(handle as object);
  const stack = session.handleStacks.get(handle as object);

  const base: Record<string, unknown> = {
    type: constructorName,
    constructor: constructorName,
    destroyed: obj.destroyed,
    readable: obj.readable,
    writable: obj.writable,
    objectKey,
    stack,
  };

  if (typeof (handle as { hasRef?: () => boolean }).hasRef === "function") {
    base.hasRef = (handle as { hasRef: () => boolean }).hasRef();
  }

  if (typeof (handle as { _idleTimeout?: number })._idleTimeout === "number") {
    base.timeout = (handle as { _idleTimeout: number })._idleTimeout;
  }

  if (constructorName === "Socket" || constructorName === "TLSSocket") {
    const socket = handle as net.Socket;
    return {
      ...base,
      localAddress: socket.localAddress,
      localPort: socket.localPort,
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
      bytesRead: socket.bytesRead,
      bytesWritten: socket.bytesWritten,
      readyState: (socket as net.Socket & { readyState?: string }).readyState,
      mongoPersistent: isMongoPersistentHandle(handle),
    };
  }

  return base;
};

const patchTimers = (): void => {
  if (session.originalSetTimeout) return;

  session.originalSetTimeout = global.setTimeout;
  session.originalSetInterval = global.setInterval;
  session.originalSetImmediate = global.setImmediate;

  global.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const timer = session.originalSetTimeout!(handler, timeout, ...args);
    if (session.active) {
      session.timers.set(timer, {
        id: timer,
        kind: "timeout",
        createdAt: Date.now(),
        stack: captureStack(),
        cleared: false,
      });
    }
    return timer;
  }) as typeof setTimeout;

  global.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const timer = session.originalSetInterval!(handler, timeout, ...args);
    if (session.active) {
      session.timers.set(timer, {
        id: timer,
        kind: "interval",
        createdAt: Date.now(),
        stack: captureStack(),
        cleared: false,
      });
    }
    return timer;
  }) as typeof setInterval;

  global.setImmediate = ((handler: ImmediateHandler, ...args: unknown[]) => {
    const immediate = session.originalSetImmediate!(handler, ...args);
    if (session.active) {
      session.timers.set(immediate, {
        id: immediate,
        kind: "immediate",
        createdAt: Date.now(),
        stack: captureStack(),
        cleared: false,
      });
    }
    return immediate;
  }) as typeof setImmediate;

  const originalClearTimeout = global.clearTimeout;
  const originalClearInterval = global.clearInterval;
  const originalClearImmediate = global.clearImmediate;

  global.clearTimeout = ((timer: ReturnType<typeof setTimeout>) => {
    const entry = session.timers.get(timer);
    if (entry) entry.cleared = true;
    originalClearTimeout(timer);
  }) as typeof clearTimeout;

  global.clearInterval = ((timer: ReturnType<typeof setInterval>) => {
    const entry = session.timers.get(timer);
    if (entry) entry.cleared = true;
    originalClearInterval(timer);
  }) as typeof clearInterval;

  global.clearImmediate = ((immediate: ReturnType<typeof setImmediate>) => {
    const entry = session.timers.get(immediate);
    if (entry) entry.cleared = true;
    originalClearImmediate(immediate);
  }) as typeof clearImmediate;
};

const unpatchTimers = (): void => {
  if (session.originalSetTimeout) global.setTimeout = session.originalSetTimeout;
  if (session.originalSetInterval) global.setInterval = session.originalSetInterval;
  if (session.originalSetImmediate) global.setImmediate = session.originalSetImmediate;
  session.originalSetTimeout = undefined;
  session.originalSetInterval = undefined;
  session.originalSetImmediate = undefined;
};

const startAsyncHook = (): void => {
  if (session.asyncHook) return;
  const hook = createHook({
    init(asyncId, type, triggerAsyncId) {
      if (!session.active) return;
      session.asyncResources.set(asyncId, {
        resourceId: asyncId,
        triggerAsyncId,
        type,
        createdAt: Date.now(),
        stack: captureStack(),
      });
    },
    destroy(asyncId) {
      const entry = session.asyncResources.get(asyncId);
      if (!entry) return;
      entry.destroyedAt = Date.now();
    },
  });
  hook.enable();
  session.asyncHook = hook;
};

const stopAsyncHook = (): void => {
  if (!session.asyncHook) return;
  session.asyncHook.disable();
  session.asyncHook = undefined;
};

export const isDrLeakDetectionActive = (): boolean => session.active;

export const initDrLeakDetection = (): void => {
  session = createEmptyLeakSession();
  session.active = true;
  session.baselineHandleCount = getActiveHandles().length;
  session.baselineRequestCount = getActiveRequests().length;
  patchTimers();
  startAsyncHook();
};

export const stopDrLeakDetection = (): void => {
  stopAsyncHook();
  unpatchTimers();
  session.active = false;
};

export const resetDrLeakDetection = (): void => {
  stopDrLeakDetection();
  session = createEmptyLeakSession();
};

export const registerDrHandleObjectKey = (
  handle: object,
  objectKey: string,
  stack?: string
): void => {
  if (!session.active) return;
  session.handleObjectKeys.set(handle, objectKey);
  session.handleStacks.set(handle, stack || captureStack());
};

export const registerDrTrackedStreamHandle = (
  stream: Readable,
  context: { objectKey: string; stage: string }
): void => {
  registerDrHandleObjectKey(stream, context.objectKey, captureStack());
};

export const registerDrArchiverDiagnostics = (
  getter: () => DrArchiverDiagnostics
): void => {
  session.archiverDiagnostics = getter;
};

export const registerDrR2UploadDiagnostics = (
  getter: () => DrR2UploadDiagnostics
): void => {
  session.r2UploadDiagnostics = getter;
};

const inspectAgent = (agent: http.Agent | https.Agent, label: string): Record<string, unknown> => {
  const typed = agent as http.Agent & {
    requests?: Record<string, unknown[]>;
    freeSockets?: Record<string, unknown[]>;
    sockets?: Record<string, unknown[]>;
  };
  const pendingRequests = typed.requests
    ? Object.values(typed.requests).reduce((sum, list) => sum + (list?.length || 0), 0)
    : 0;
  const freeSockets = typed.freeSockets
    ? Object.values(typed.freeSockets).reduce((sum, list) => sum + (list?.length || 0), 0)
    : 0;
  const keepAliveSockets = typed.sockets
    ? Object.values(typed.sockets).reduce((sum, list) => sum + (list?.length || 0), 0)
    : 0;

  return {
    label,
    keepAliveSockets,
    freeSockets,
    pendingRequests,
  };
};

const inspectHttpAgents = (): Record<string, unknown>[] => {
  const agents: Record<string, unknown>[] = [
    inspectAgent(http.globalAgent, "http.globalAgent"),
    inspectAgent(https.globalAgent, "https.globalAgent"),
  ];

  try {
    const undici = require("undici") as {
      getGlobalDispatcher?: () => { stats?: () => Record<string, unknown> };
    };
    const dispatcher = undici.getGlobalDispatcher?.();
    if (dispatcher?.stats) {
      agents.push({ label: "undici.globalDispatcher", ...dispatcher.stats() });
    }
  } catch {
    // undici optional
  }

  return agents;
};

const inspectAwsSdkAgent = (): Record<string, unknown> => {
  try {
    const { getR2Client } = require("@/lib/r2") as { getR2Client: () => unknown };
    const client = getR2Client() as {
      config?: { requestHandler?: { httpHandler?: { socketWarningTimestamp?: number } } };
      middlewareStack?: unknown;
    };
    return {
      clientType: client?.constructor?.name ?? "Unknown",
      hasClient: Boolean(client),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const logEventLoopSnapshot = (): { handles: unknown[]; requests: unknown[] } => {
  const handles = getActiveHandles();
  const requests = getActiveRequests();

  console.info("[DR] EVENT_LOOP_SNAPSHOT", {
    activeHandles: handles.length,
    activeRequests: requests.length,
    baselineHandles: session.baselineHandleCount,
    baselineRequests: session.baselineRequestCount,
  });

  handles.forEach((handle, index) => {
    console.info("[DR] ACTIVE_HANDLE", { index, ...describeHandle(handle) });
  });

  requests.forEach((request, index) => {
    console.info("[DR] ACTIVE_REQUEST", { index, ...describeHandle(request) });
  });

  return { handles, requests };
};

const getOpenTimers = (): DrTimerEntry[] =>
  Array.from(session.timers.values()).filter((entry) => !entry.cleared);

const getOpenSockets = (handles: unknown[]): Record<string, unknown>[] =>
  handles
    .filter((handle) => {
      const name = handle?.constructor?.name ?? "";
      return name === "Socket" || name === "TLSSocket";
    })
    .map((handle) => describeHandle(handle))
    .filter((entry) => !entry.mongoPersistent && !entry.destroyed);

const getPendingAsyncResources = (): DrAsyncResourceEntry[] =>
  Array.from(session.asyncResources.values()).filter((entry) => !entry.destroyedAt);

export { getPendingAsyncResources };

const countNonMongoHandles = (handles: unknown[]): number =>
  handles.filter((handle) => !isMongoPersistentHandle(handle)).length;

export const verifyDrArchiverListeners = (): DrArchiverDiagnostics | null => {
  if (!session.archiverDiagnostics) return null;
  const diagnostics = session.archiverDiagnostics();
  const listenerIssues = [
    ...Object.entries(diagnostics.archiveListeners || {}).filter(([, count]) => count > 0),
    ...Object.entries(diagnostics.outputListeners || {}).filter(([, count]) => count > 0),
  ];
  if (listenerIssues.length > 0) {
    console.warn("[DR] ARCHIVER_LISTENERS_REMAIN", diagnostics);
  } else {
    console.info("[DR] ARCHIVER_VERIFY", diagnostics);
  }
  return diagnostics;
};

export const verifyDrR2Upload = (): DrR2UploadDiagnostics | null => {
  if (!session.r2UploadDiagnostics) return null;
  const diagnostics = session.r2UploadDiagnostics();
  console.info("[DR] AWS_SDK_UPLOAD_VERIFY", diagnostics);
  if (!diagnostics.uploadCompleted) {
    console.warn("[DR] AWS_SDK_UPLOAD_INCOMPLETE", diagnostics);
  }
  if (diagnostics.bodyStreamDestroyed === false || diagnostics.bodyStreamClosed === false) {
    console.warn("[DR] AWS_SDK_BODY_STREAM_OPEN", diagnostics);
  }
  return diagnostics;
};

export const printDrLeakReport = (): void => {
  if (!session.active && session.baselineHandleCount === 0 && session.asyncResources.size === 0) {
    return;
  }

  const { handles, requests } = logEventLoopSnapshot();
  const openTimers = getOpenTimers();
  const openSockets = getOpenSockets(handles);
  const pendingAsync = getPendingAsyncResources();
  const openStreams = getOpenDrStreams();
  const pendingPromises = getPendingDrPromises();
  const agents = inspectHttpAgents();
  const awsAgent = inspectAwsSdkAgent();

  console.info("[DR] HTTP_AGENT_VERIFY", { agents, awsAgent });
  verifyDrArchiverListeners();
  verifyDrR2Upload();

  if (openTimers.length > 0) {
    console.warn("[DR] OPEN_TIMERS", {
      count: openTimers.length,
      timers: openTimers.map((entry) => ({
        kind: entry.kind,
        ageMs: Date.now() - entry.createdAt,
        stack: entry.stack,
      })),
    });
  }

  if (pendingAsync.length > 0) {
    console.warn("[DR] PENDING_ASYNC_RESOURCES", {
      count: pendingAsync.length,
      resources: pendingAsync.map((entry) => ({
        resourceId: entry.resourceId,
        triggerAsyncId: entry.triggerAsyncId,
        type: entry.type,
        ageMs: Date.now() - entry.createdAt,
        stack: entry.stack,
      })),
    });
  }

  const activeHandlesExMongo = countNonMongoHandles(handles);
  const activeRequestsCount = requests.length;

  const lines = [
    "========== DR LEAK REPORT ==========",
    `Active Handles: ${activeHandlesExMongo}`,
    `Active Requests: ${activeRequestsCount}`,
    `Open Timers: ${openTimers.length}`,
    `Open Sockets: ${openSockets.length}`,
    `Pending Async Resources: ${pendingAsync.length}`,
    `Open Streams: ${openStreams.length}`,
    `Pending Promises: ${pendingPromises.length}`,
    "===================================",
  ];

  console.info(lines.join("\n"));
};

export const runInDrAsyncScope = <T>(name: string, fn: () => T): T => {
  const resource = new AsyncResource(`DR:${name}`);
  return resource.runInAsyncScope(fn);
};
