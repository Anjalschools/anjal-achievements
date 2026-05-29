/**
 * Per-facet response byte budgets — progressive UI scopes only (export uses full cap).
 */

import { estimateFocusedPayloadBytes } from "@/lib/analytics/focused-payload-governor";
import { recordExecDegradedFacet, recordExecRuntimeWarning } from "@/lib/analytics/runtime/runtime-health-registry";

export const FOCUSED_FACET_BUDGET_BYTES: Record<string, number> = {
  summary: 1 * 1024 * 1024,
  participants: 4 * 1024 * 1024,
  charts: 2 * 1024 * 1024,
  trends: 2 * 1024 * 1024,
  insights: 2 * 1024 * 1024,
  compare: 4 * 1024 * 1024,
  executive: 6 * 1024 * 1024,
  full: 14 * 1024 * 1024,
};

export type FacetBudgetResult = {
  bytes: number;
  budgetBytes: number;
  exceeded: boolean;
  trimmed: boolean;
  degraded: boolean;
  payload: Record<string, unknown>;
};

const trimByScope = (scope: string, payload: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...payload };

  if (scope === "participants" && Array.isArray(out.participants) && out.participants.length > 25) {
    out.participants = (out.participants as unknown[]).slice(0, 25);
  }
  if (scope === "charts" && out.charts && typeof out.charts === "object") {
    const c = { ...(out.charts as Record<string, unknown>) };
    for (const k of Object.keys(c)) {
      if (Array.isArray(c[k]) && (c[k] as unknown[]).length > 24) {
        c[k] = (c[k] as unknown[]).slice(0, 24);
      }
    }
    out.charts = c;
  }
  if (scope === "insights" && out.decisionPlatform && typeof out.decisionPlatform === "object") {
    const dp = { ...(out.decisionPlatform as Record<string, unknown>) };
    if (Array.isArray(dp.recommendations) && dp.recommendations.length > 8) {
      dp.recommendations = dp.recommendations.slice(0, 8);
    }
    if (Array.isArray(dp.alerts) && dp.alerts.length > 5) {
      dp.alerts = dp.alerts.slice(0, 5);
    }
    out.decisionPlatform = dp;
  }
  if (scope === "compare" && out.executive && typeof out.executive === "object") {
    const ex = { ...(out.executive as Record<string, unknown>) };
    if (Array.isArray(ex.yearComparison) && ex.yearComparison.length > 12) {
      ex.yearComparison = ex.yearComparison.slice(0, 12);
    }
    out.executive = ex;
  }
  if ("rankingPool" in out) delete out.rankingPool;

  return out;
};

/** Enforce facet byte budget — trim + degrade, never throw raw BSON errors to client. */
export const enforceFocusedFacetBudget = (
  scope: string,
  payload: unknown,
  meta?: { correlationId?: string }
): FacetBudgetResult => {
  const budgetBytes = FOCUSED_FACET_BUDGET_BYTES[scope] ?? FOCUSED_FACET_BUDGET_BYTES.summary;
  let current: Record<string, unknown> =
    payload && typeof payload === "object" ? { ...(payload as Record<string, unknown>) } : {};
  let bytes = estimateFocusedPayloadBytes(current);
  let trimmed = false;
  let degraded = false;

  if (bytes > budgetBytes) {
    recordExecRuntimeWarning("[FOCUSED_BUDGET_EXCEEDED]", {
      scope,
      bytes,
      budgetBytes,
      correlationId: meta?.correlationId,
    });
    current = trimByScope(scope, current);
    trimmed = true;
    degraded = true;
    recordExecDegradedFacet(scope);
    bytes = estimateFocusedPayloadBytes(current);
  }

  if (bytes > budgetBytes) {
    current = trimByScope(scope, current);
    trimmed = true;
    degraded = true;
    bytes = estimateFocusedPayloadBytes(current);
  }

  if (degraded) {
    current = { ...current, degraded: true };
  }

  return {
    bytes,
    budgetBytes,
    exceeded: bytes > budgetBytes,
    trimmed,
    degraded,
    payload: current,
  };
};
