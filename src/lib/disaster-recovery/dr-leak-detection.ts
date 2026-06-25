import { AsyncResource, createHook, type AsyncHook } from "node:async_hooks";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { Readable } from "node:stream";
import {
  captureDrStack,
  DR_MAX_HANDLE_DETAIL_LOGS,
  DR_MAX_TRACKED_ASYNC_RESOURCES,
  DR_MAX_TRACKED_TIMERS,
  shouldCaptureDrStacks,
} from "@/lib/disaster-recovery/dr-diag-policy";
import {
  emitDeferredRegistryOverflowWarning,
  isDrAsyncHookEnabled,
  logDrRegistryLimit,
  recordDrRegistryOverflow,
  resetDrDiagGuard,
  setDrAsyncHookEnabled,
} from "@/lib/disaster-recovery/dr-diag-guard";
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
  seq: number;
};

type DrTimerEntry = {
  id: unknown;
  kind: "timeout" | "interval" | "immediate";
  createdAt: number;
  stack?: string;
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
  handleObjectKeys: WeakMap<object, string>;
  asyncResources: Map<number, DrAsyncResourceEntry>;
  asyncResourceSeq: number;
  timers: Map<unknown, DrTimerEntry>;
  archiverDiagnostics?: () => DrArchiverDiagnostics;
  r2UploadDiagnostics?: () => DrR2UploadDiagnostics;
  asyncHook?: AsyncHook;
  baselineHandleCount: number;
  baselineRequestCount: number;
};

const createEmptyLeakSession = (): DrLeakSession => ({
  active: false,
  handleObjectKeys: new WeakMap(),
  asyncResources: new Map(),
  asyncResourceSeq: 0,
  timers: new Map(),
  baselineHandleCount: 0,
  baselineRequestCount: 0,
});

let session: DrLeakSession = createEmptyLeakSession();

let timersPatched = false;
const nativeSetTimeout = global.setTimeout.bind(global);
const nativeSetInterval = global.setInterval.bind(global);
const nativeSetImmediate = global.setImmediate.bind(global);
const nativeClearTimeout = global.clearTimeout.bind(global);
const nativeClearInterval = global.clearInterval.bind(global);
const nativeClearImmediate = global.clearImmediate.bind(global);

const onAsyncHookInit = (asyncId: number, type: string, triggerAsyncId: number): void => {
  if (!session.active) return;
  if (session.asyncResources.size >= DR_MAX_TRACKED_ASYNC_RESOURCES) {
    recordDrRegistryOverflow("asyncResources");
    return;
  }
  const seq = session.asyncResourceSeq;
  session.asyncResourceSeq = seq + 1;
  session.asyncResources.set(asyncId, {
    resourceId: asyncId,
    triggerAsyncId,
    type,
    seq,
  });
};

const onAsyncHookDestroy = (asyncId: number): void => {
  session.asyncResources.delete(asyncId);
};

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

const describeHandlePrimitives = (handle: unknown): Record<string, unknown> => {
  if (!handle || typeof handle !== "object") {
    return { type: typeof handle };
  }

  const obj = handle as Record<string, unknown>;
  const constructorName = handle.constructor?.name ?? "Unknown";
  const objectKey = session.handleObjectKeys.get(handle as object);

  const base: Record<string, unknown> = {
    type: constructorName,
    constructor: constructorName,
    destroyed: obj.destroyed,
    readable: obj.readable,
    writable: obj.writable,
    objectKey,
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
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
      bytesRead: socket.bytesRead,
      bytesWritten: socket.bytesWritten,
      mongoPersistent: isMongoPersistentHandle(handle),
    };
  }

  return base;
};

const trackTimer = (timer: unknown, kind: DrTimerEntry["kind"]): void => {
  if (!session.active) return;
  if (session.timers.size >= DR_MAX_TRACKED_TIMERS) {
    logDrRegistryLimit("timers", DR_MAX_TRACKED_TIMERS);
    return;
  }
  session.timers.set(timer, {
    id: timer,
    kind,
    createdAt: Date.now(),
    stack: isDrAsyncHookEnabled() ? undefined : captureDrStack(),
  });
};

const patchTimers = (): void => {
  if (timersPatched) return;
  timersPatched = true;

  global.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof handler !== "function") {
      const timer = nativeSetTimeout(handler, timeout, ...args);
      trackTimer(timer, "timeout");
      return timer;
    }

    const fn = handler as (...handlerArgs: unknown[]) => void;
    let timer: ReturnType<typeof setTimeout>;
    timer = nativeSetTimeout((...handlerArgs: unknown[]) => {
      try {
        fn(...handlerArgs);
      } finally {
        session.timers.delete(timer);
      }
    }, timeout, ...args);
    trackTimer(timer, "timeout");
    return timer;
  }) as typeof setTimeout;

  global.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const timer = nativeSetInterval(handler, timeout, ...args);
    trackTimer(timer, "interval");
    return timer;
  }) as typeof setInterval;

  global.setImmediate = ((handler: (...args: unknown[]) => void, ...args: unknown[]) => {
    const wrapped = (...immediateArgs: unknown[]) => {
      try {
        handler(...immediateArgs);
      } finally {
        session.timers.delete(immediate);
      }
    };
    const immediate = nativeSetImmediate(wrapped, ...args);
    trackTimer(immediate, "immediate");
    return immediate;
  }) as typeof setImmediate;

  global.clearTimeout = ((timer: ReturnType<typeof setTimeout>) => {
    session.timers.delete(timer);
    nativeClearTimeout(timer);
  }) as typeof clearTimeout;

  global.clearInterval = ((timer: ReturnType<typeof setInterval>) => {
    session.timers.delete(timer);
    nativeClearInterval(timer);
  }) as typeof clearInterval;

  global.clearImmediate = ((immediate: ReturnType<typeof setImmediate>) => {
    session.timers.delete(immediate);
    nativeClearImmediate(immediate);
  }) as typeof clearImmediate;
};

const unpatchTimers = (): void => {
  if (!timersPatched) return;
  global.setTimeout = nativeSetTimeout as typeof setTimeout;
  global.setInterval = nativeSetInterval as typeof setInterval;
  global.setImmediate = nativeSetImmediate as typeof setImmediate;
  global.clearTimeout = nativeClearTimeout as typeof clearTimeout;
  global.clearInterval = nativeClearInterval as typeof clearInterval;
  global.clearImmediate = nativeClearImmediate as typeof clearImmediate;
  timersPatched = false;
};

const startAsyncHook = (): void => {
  if (session.asyncHook) return;
  const hook = createHook({
    init(asyncId, type, triggerAsyncId) {
      onAsyncHookInit(asyncId, type, triggerAsyncId);
    },
    destroy(asyncId) {
      onAsyncHookDestroy(asyncId);
    },
  });
  hook.enable();
  session.asyncHook = hook;
  setDrAsyncHookEnabled(true);
};

const stopAsyncHook = (): void => {
  if (!session.asyncHook && !isDrAsyncHookEnabled()) return;
  if (session.asyncHook) {
    session.asyncHook.disable();
    session.asyncHook = undefined;
  }
  setDrAsyncHookEnabled(false);
  emitDeferredRegistryOverflowWarning();
};

export const isDrLeakDetectionActive = (): boolean => session.active;

export const isDrLeakHookEnabled = (): boolean => isDrAsyncHookEnabled();

export const initDrLeakDetection = (): void => {
  resetDrDiagGuard();
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
  resetDrDiagGuard();
};

export const registerDrHandleObjectKey = (handle: object, objectKey: string): void => {
  if (!session.active) return;
  session.handleObjectKeys.set(handle, objectKey);
};

export const registerDrTrackedStreamHandle = (
  stream: Readable,
  context: { objectKey: string; stage: string }
): void => {
  registerDrHandleObjectKey(stream, context.objectKey);
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

export const getDrLeakRegistryCounts = (): {
  activeTimers: number;
  activeResources: number;
} => ({
  activeTimers: session.timers.size,
  activeResources: session.asyncResources.size,
});

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

const inspectUndiciOptional = async (): Promise<Record<string, unknown> | null> => {
  try {
    const specifier = "undici";
    const undici = (await Function(`return import(${JSON.stringify(specifier)})`)()) as {
      getGlobalDispatcher?: () => { stats?: () => Record<string, unknown> };
    };
    const dispatcher = undici.getGlobalDispatcher?.();
    if (dispatcher?.stats) {
      return { label: "undici.globalDispatcher", ...dispatcher.stats() };
    }
    return null;
  } catch {
    console.info("[DR] HTTP_AGENT_VERIFY_SKIPPED", { reason: "undici_not_installed" });
    return null;
  }
};

const inspectHttpAgents = async (): Promise<Record<string, unknown>[]> => {
  const agents: Record<string, unknown>[] = [
    inspectAgent(http.globalAgent, "http.globalAgent"),
    inspectAgent(https.globalAgent, "https.globalAgent"),
  ];

  const undiciAgent = await inspectUndiciOptional();
  if (undiciAgent) {
    agents.push(undiciAgent);
  }

  return agents;
};

const inspectAwsSdkAgent = (): Record<string, unknown> => {
  try {
    const { getR2Client } = require("@/lib/r2") as { getR2Client: () => unknown };
    const client = getR2Client() as { constructor?: { name?: string } };
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

const logEventLoopSnapshot = (includeDetails: boolean): { handles: unknown[]; requests: unknown[] } => {
  const handles = getActiveHandles();
  const requests = getActiveRequests();

  console.info("[DR] EVENT_LOOP_SNAPSHOT", {
    activeHandles: handles.length,
    activeRequests: requests.length,
    baselineHandles: session.baselineHandleCount,
    baselineRequests: session.baselineRequestCount,
  });

  if (!includeDetails) {
    return { handles, requests };
  }

  handles.slice(0, DR_MAX_HANDLE_DETAIL_LOGS).forEach((handle, index) => {
    console.info("[DR] ACTIVE_HANDLE", { index, ...describeHandlePrimitives(handle) });
  });

  requests.slice(0, DR_MAX_HANDLE_DETAIL_LOGS).forEach((request, index) => {
    console.info("[DR] ACTIVE_REQUEST", { index, ...describeHandlePrimitives(request) });
  });

  return { handles, requests };
};

const getOpenTimers = (): DrTimerEntry[] => Array.from(session.timers.values());

const getOpenSockets = (handles: unknown[]): Record<string, unknown>[] =>
  handles
    .filter((handle) => {
      const name = handle?.constructor?.name ?? "";
      return name === "Socket" || name === "TLSSocket";
    })
    .map((handle) => describeHandlePrimitives(handle))
    .filter((entry) => !entry.mongoPersistent && !entry.destroyed);

const getPendingAsyncResources = (): DrAsyncResourceEntry[] =>
  Array.from(session.asyncResources.values());

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
    console.warn("[DR] ARCHIVER_LISTENERS_REMAIN", {
      archivePointer: diagnostics.archivePointer,
      archiveAborted: diagnostics.archiveAborted,
      archiveDestroyed: diagnostics.archiveDestroyed,
      outputDestroyed: diagnostics.outputDestroyed,
      outputClosed: diagnostics.outputClosed,
    });
  } else {
    console.info("[DR] ARCHIVER_VERIFY", {
      archivePointer: diagnostics.archivePointer,
      outputDestroyed: diagnostics.outputDestroyed,
      outputClosed: diagnostics.outputClosed,
    });
  }
  return diagnostics;
};

export const verifyDrR2Upload = (): DrR2UploadDiagnostics | null => {
  if (!session.r2UploadDiagnostics) return null;
  const diagnostics = session.r2UploadDiagnostics();
  console.info("[DR] AWS_SDK_UPLOAD_VERIFY", {
    uploadCompleted: diagnostics.uploadCompleted,
    bodyStreamDestroyed: diagnostics.bodyStreamDestroyed,
    bodyStreamClosed: diagnostics.bodyStreamClosed,
  });
  if (!diagnostics.uploadCompleted) {
    console.warn("[DR] AWS_SDK_UPLOAD_INCOMPLETE", { uploadCompleted: false });
  }
  if (diagnostics.bodyStreamDestroyed === false || diagnostics.bodyStreamClosed === false) {
    console.warn("[DR] AWS_SDK_BODY_STREAM_OPEN", {
      bodyStreamDestroyed: diagnostics.bodyStreamDestroyed,
      bodyStreamClosed: diagnostics.bodyStreamClosed,
    });
  }
  return diagnostics;
};

const logOpenTimersDetail = (openTimers: DrTimerEntry[]): void => {
  if (openTimers.length === 0) return;
  console.warn("[DR] OPEN_TIMERS", { count: openTimers.length });
  const stacksEnabled = shouldCaptureDrStacks();
  for (const entry of openTimers.slice(0, DR_MAX_HANDLE_DETAIL_LOGS)) {
    console.warn("[DR] OPEN_TIMER", {
      kind: entry.kind,
      ageMs: entry.createdAt > 0 ? Date.now() - entry.createdAt : undefined,
      stack: stacksEnabled ? entry.stack ?? captureDrStack() : undefined,
    });
  }
};

const logPendingAsyncDetail = (pendingAsync: DrAsyncResourceEntry[]): void => {
  if (pendingAsync.length === 0) return;
  console.warn("[DR] PENDING_ASYNC_RESOURCES", { count: pendingAsync.length });
  for (const entry of pendingAsync.slice(0, DR_MAX_HANDLE_DETAIL_LOGS)) {
    console.warn("[DR] PENDING_ASYNC_RESOURCE", {
      resourceId: entry.resourceId,
      triggerAsyncId: entry.triggerAsyncId,
      type: entry.type,
      seq: entry.seq,
    });
  }
};

export const printDrLeakReport = async (): Promise<void> => {
  stopAsyncHook();

  if (!session.active && session.baselineHandleCount === 0 && session.asyncResources.size === 0) {
    return;
  }

  const openTimers = getOpenTimers();
  const openStreams = getOpenDrStreams();
  const pendingPromises = getPendingDrPromises();
  const pendingAsync = getPendingAsyncResources();

  const hasLeaks =
    openTimers.length > 0 ||
    pendingAsync.length > 0 ||
    openStreams.length > 0 ||
    pendingPromises.length > 0;

  const { handles, requests } = logEventLoopSnapshot(hasLeaks);
  const openSockets = getOpenSockets(handles);
  const agents = await inspectHttpAgents();
  const awsAgent = inspectAwsSdkAgent();

  console.info("[DR] HTTP_AGENT_VERIFY", {
    agentCount: agents.length,
    awsClientType: awsAgent.clientType ?? awsAgent.error,
  });
  for (const agent of agents) {
    console.info("[DR] HTTP_AGENT", agent);
  }

  verifyDrArchiverListeners();
  verifyDrR2Upload();

  const activeHandlesExMongo = countNonMongoHandles(handles);
  const activeRequestsCount = requests.length;

  console.info("========== DR LEAK REPORT ==========");
  console.info(`Active Handles: ${activeHandlesExMongo}`);
  console.info(`Active Requests: ${activeRequestsCount}`);
  console.info(`Open Timers: ${openTimers.length}`);
  console.info(`Open Sockets: ${openSockets.length}`);
  console.info(`Pending Async Resources: ${pendingAsync.length}`);
  console.info(`Open Streams: ${openStreams.length}`);
  console.info(`Pending Promises: ${pendingPromises.length}`);
  console.info("===================================");

  if (hasLeaks) {
    logOpenTimersDetail(openTimers);
    logPendingAsyncDetail(pendingAsync);
  }
};

export const runInDrAsyncScope = <T>(name: string, fn: () => T): T => {
  const resource = new AsyncResource(`DR:${name}`);
  return resource.runInAsyncScope(fn);
};

export const __drLeakHookTestInternals = {
  onAsyncHookInit,
  onAsyncHookDestroy,
};
