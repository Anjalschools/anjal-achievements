/**
 * Shared funnel validation utilities — leaf-safe (no intelligence/validator imports).
 */

import {
  FUNNEL_TRANSITION_PAIRS,
  STAGE_ORDER,
  type HistoricalFunnelStageKey,
} from "@/lib/analytics/shared/historical-funnel-stages";
import type {
  FunnelTransitionMetrics,
  YearFunnelSnapshot,
} from "@/lib/analytics/shared/historical-funnel-types";

export type FunnelValidationIssue = {
  code: string;
  messageAr: string;
  messageEn: string;
  severity: "warning" | "error";
};

export const validateTransitionDenominator = (t: FunnelTransitionMetrics): boolean =>
  t.valid && t.sourceCount >= 3 && t.targetCount > 0 && t.targetCount <= t.sourceCount;

export const validateTransitionLegality = (t: FunnelTransitionMetrics): boolean => {
  const pair = FUNNEL_TRANSITION_PAIRS.find((p) => p.key === t.key);
  if (!pair) return false;
  if (t.to === "international" && t.from !== "acceptance") return false;
  const fromIdx = STAGE_ORDER.indexOf(t.from);
  const toIdx = STAGE_ORDER.indexOf(t.to);
  return fromIdx >= 0 && toIdx === fromIdx + 1;
};

export const validateStageContinuity = (snapshot: YearFunnelSnapshot): FunnelValidationIssue[] => {
  const issues: FunnelValidationIssue[] = [];
  const stages = snapshot.displayStages;
  let seenZero = false;

  for (const key of STAGE_ORDER) {
    const v = stages[key] ?? 0;
    if (seenZero && v > 0) {
      issues.push({
        code: "continuity_break",
        messageAr: `قفزة غير منطقية بعد مرحلة صفرية (${key})`,
        messageEn: `Illogical jump after zero stage (${key})`,
        severity: "error",
      });
    }
    if (v <= 0) seenZero = true;
  }
  return issues;
};

export const isTerminalStage = (key: HistoricalFunnelStageKey): boolean =>
  key === "international";
