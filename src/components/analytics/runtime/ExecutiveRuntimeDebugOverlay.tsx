"use client";

import { memo, useEffect, useState } from "react";
import {
  getExecAnalyticsRuntimeSnapshot,
  initExecAnalyticsRuntimeDevExpose,
  subscribeExecAnalyticsRuntime,
} from "@/lib/analytics/runtime/runtime-health-registry";
import { getChartWatchdogSnapshot } from "@/lib/analytics/runtime/chart-watchdog";
import { getAnalyticsCacheMetrics } from "@/lib/analytics/runtime/analytics-cache-governance";
const DEBUG_FLAG = "exec_analytics_debug_overlay";

const isOverlayEnabled = (): boolean => {
  if (process.env.NODE_ENV === "production") return false;
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEBUG_FLAG) !== "0";
  } catch {
    return true;
  }
};

export const ExecutiveRuntimeDebugOverlay = memo(() => {
  const [visible, setVisible] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isOverlayEnabled()) return;
    initExecAnalyticsRuntimeDevExpose();
    setVisible(true);
    const unsub = subscribeExecAnalyticsRuntime(() => setTick((n) => n + 1));
    const id = window.setInterval(() => setTick((n) => n + 1), 1500);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  if (!visible) return null;

  void tick;
  const snap = getExecAnalyticsRuntimeSnapshot();
  const cache = getAnalyticsCacheMetrics();
  const charts = getChartWatchdogSnapshot();
  const inflight = Object.keys(snap.inflightRequests).length;
  const activeFacets = Object.keys(snap.activeFacets).length;
  const hitRatio =
    snap.cacheHits + snap.cacheMisses > 0
      ? Math.round((snap.cacheHits / (snap.cacheHits + snap.cacheMisses)) * 100)
      : 0;

  const mem =
    typeof performance !== "undefined"
      ? (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
      : undefined;

  return (
    <div
      className="fixed bottom-3 start-3 z-[9999] max-h-[40vh] w-[min(22rem,92vw)] overflow-auto rounded-xl border border-slate-700 bg-slate-950/95 p-3 font-mono text-[10px] leading-snug text-emerald-100 shadow-2xl print:hidden"
      dir="ltr"
      role="complementary"
      aria-label="Executive analytics runtime debug"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-black text-emerald-300">EXEC RUNTIME</span>
        <button
          type="button"
          className="rounded border border-slate-600 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-slate-800"
          onClick={() => {
            try {
              localStorage.setItem(DEBUG_FLAG, "0");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          hide
        </button>
      </div>
      <ul className="space-y-1 text-slate-300">
        <li>facets active: {activeFacets}</li>
        <li>inflight: {inflight}</li>
        <li>aborted: {snap.abortedTotal}</li>
        <li>cache hit: {hitRatio}% ({snap.cacheHits}/{snap.cacheMisses})</li>
        <li>cache evict: {cache.evictions}</li>
        <li>export: {snap.exportRuntimeActive ? "yes" : "no"}</li>
        <li>heap: {mem ? `${Math.round(mem / 1024 / 1024)}MB` : "n/a"}</li>
        <li>warnings: {snap.runtimeWarnings.length}</li>
      </ul>
      {snap.runtimeWarnings[0] ? (
        <p className="mt-2 truncate text-amber-300" title={snap.runtimeWarnings[0].tag}>
          {snap.runtimeWarnings[0].tag}
        </p>
      ) : null}
      {Object.keys(charts).length ? (
        <p className="mt-1 text-sky-300">
          charts: {Object.keys(charts).length} (
          {Object.values(charts).filter((c) => c.simplifiedMode).length} simplified)
        </p>
      ) : null}
      <p className="mt-2 text-[9px] text-slate-500">
        window.__EXEC_ANALYTICS_RUNTIME__ · set localStorage {DEBUG_FLAG}=0 to hide
      </p>
    </div>
  );
});
ExecutiveRuntimeDebugOverlay.displayName = "ExecutiveRuntimeDebugOverlay";
