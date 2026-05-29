/**
 * Charts runtime watchdog — detects resize storms, remount churn, slow renders.
 */

import { recordExecRuntimeWarning } from "@/lib/analytics/runtime/runtime-health-registry";

const RENDER_WARN_MS = 2_500;
const RESIZE_BURST_WINDOW_MS = 3_000;
const RESIZE_BURST_MAX = 12;
const REMOUNT_WARN_COUNT = 6;

type ChartMetrics = {
  mountCount: number;
  renderCount: number;
  resizeTimestamps: number[];
  lastRenderMs: number;
  simplifiedMode: boolean;
  resizeFrozenUntil: number;
};

const charts = new Map<string, ChartMetrics>();

const getOrCreate = (chartId: string): ChartMetrics => {
  let m = charts.get(chartId);
  if (!m) {
    m = {
      mountCount: 0,
      renderCount: 0,
      resizeTimestamps: [],
      lastRenderMs: 0,
      simplifiedMode: false,
      resizeFrozenUntil: 0,
    };
    charts.set(chartId, m);
  }
  return m;
};

export const recordChartMount = (chartId: string): void => {
  const m = getOrCreate(chartId);
  m.mountCount += 1;
  if (m.mountCount >= REMOUNT_WARN_COUNT) {
    recordExecRuntimeWarning("[FOCUSED_CHART_WATCHDOG]", {
      chartId,
      reason: "remount_churn",
      mountCount: m.mountCount,
    });
    m.simplifiedMode = true;
  }
};

export const recordChartRender = (chartId: string, durationMs: number): void => {
  const m = getOrCreate(chartId);
  m.renderCount += 1;
  m.lastRenderMs = durationMs;
  if (durationMs > RENDER_WARN_MS) {
    recordExecRuntimeWarning("[FOCUSED_CHART_WATCHDOG]", {
      chartId,
      reason: "slow_render",
      durationMs,
    });
    m.simplifiedMode = true;
  }
};

export const recordChartResize = (chartId: string): void => {
  const m = getOrCreate(chartId);
  const now = Date.now();
  m.resizeTimestamps.push(now);
  m.resizeTimestamps = m.resizeTimestamps.filter((t) => now - t < RESIZE_BURST_WINDOW_MS);
  if (m.resizeTimestamps.length >= RESIZE_BURST_MAX) {
    recordExecRuntimeWarning("[FOCUSED_CHART_WATCHDOG]", {
      chartId,
      reason: "resize_storm",
      count: m.resizeTimestamps.length,
    });
    m.simplifiedMode = true;
    m.resizeFrozenUntil = now + 1_500;
  }
};

export const shouldChartUseSimplifiedMode = (chartId: string): boolean => {
  const m = charts.get(chartId);
  if (!m) return false;
  if (m.simplifiedMode) return true;
  if (m.resizeFrozenUntil > Date.now()) return true;
  return false;
};

export const shouldChartDisableAnimation = (chartId: string): boolean => shouldChartUseSimplifiedMode(chartId);

export const isChartResizeFrozen = (chartId: string): boolean => {
  const m = charts.get(chartId);
  return Boolean(m && m.resizeFrozenUntil > Date.now());
};

export const getChartWatchdogSnapshot = (): Record<string, Omit<ChartMetrics, "resizeTimestamps"> & { resizeBurst: number }> => {
  const out: Record<string, Omit<ChartMetrics, "resizeTimestamps"> & { resizeBurst: number }> = {};
  for (const [id, m] of charts) {
    out[id] = {
      mountCount: m.mountCount,
      renderCount: m.renderCount,
      lastRenderMs: m.lastRenderMs,
      simplifiedMode: m.simplifiedMode,
      resizeFrozenUntil: m.resizeFrozenUntil,
      resizeBurst: m.resizeTimestamps.length,
    };
  }
  return out;
};

export const resetChartWatchdog = (chartId?: string): void => {
  if (chartId) charts.delete(chartId);
  else charts.clear();
};
