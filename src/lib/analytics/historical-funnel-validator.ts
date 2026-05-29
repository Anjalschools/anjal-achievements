/**
 * Historical funnel validator — continuity, denominators, legal transitions.
 */

import {
  FUNNEL_TRANSITION_PAIRS,
  HISTORICAL_FUNNEL_STAGES,
  isFunnelStagesReady,
} from "@/lib/analytics/shared/historical-funnel-stages";
import type { HistoricalFunnelIntelligence } from "@/lib/analytics/shared/historical-funnel-types";
import {
  type FunnelValidationIssue,
  validateStageContinuity,
  validateTransitionDenominator,
  validateTransitionLegality,
  isTerminalStage,
} from "@/lib/analytics/shared/funnel-utils";

export type { FunnelValidationIssue } from "@/lib/analytics/shared/funnel-utils";
export {
  validateTransitionDenominator,
  validateTransitionLegality,
  validateStageContinuity,
  isTerminalStage,
} from "@/lib/analytics/shared/funnel-utils";

export const validateFunnelSnapshot = (snapshot: Parameters<typeof validateStageContinuity>[0]) => {
  if (!isFunnelStagesReady()) {
    return [
      {
        code: "funnel_init_error",
        messageAr: "تعذّر تهيئة مراحل المسار التاريخي.",
        messageEn: "Historical funnel stages failed to initialize.",
        severity: "error" as const,
      },
    ];
  }

  const issues = validateStageContinuity(snapshot);
  for (const t of snapshot.transitions) {
    if (!t.valid) continue;
    if (!validateTransitionLegality(t)) {
      issues.push({
        code: "illegal_transition",
        messageAr: `انتقال غير مسموح: ${t.from} → ${t.to}`,
        messageEn: `Illegal transition: ${t.from} → ${t.to}`,
        severity: "error",
      });
    }
    if (!validateTransitionDenominator(t)) {
      issues.push({
        code: "invalid_denominator",
        messageAr: `مقام غير صالح للانتقال ${t.key}`,
        messageEn: `Invalid denominator for ${t.key}`,
        severity: "warning",
      });
    }
  }
  return issues;
};

export const validateHistoricalFunnel = (
  funnel: HistoricalFunnelIntelligence | null | undefined
): { valid: boolean; issues: FunnelValidationIssue[] } => {
  if (!funnel) return { valid: false, issues: [] };
  if (!isFunnelStagesReady()) {
    return {
      valid: false,
      issues: [
        {
          code: "funnel_init_error",
          messageAr: "تعذّر تهيئة مراحل المسار التاريخي.",
          messageEn: "Historical funnel stages failed to initialize.",
          severity: "error",
        },
      ],
    };
  }

  const issues = funnel.snapshots.flatMap(validateFunnelSnapshot);
  const rankable = funnel.strongestTransition;
  const weakest = funnel.weakestTransition;
  if (rankable && !validateTransitionLegality(rankable)) {
    issues.push({
      code: "weak_narrative_strong",
      messageAr: "أقوى انتقال غير صالح دلاليًا",
      messageEn: "Strongest transition is semantically invalid",
      severity: "error",
    });
  }
  if (weakest && !validateTransitionLegality(weakest)) {
    issues.push({
      code: "weak_narrative_weak",
      messageAr: "أضعف انتقال غير صالح دلاليًا",
      messageEn: "Weakest transition is semantically invalid",
      severity: "error",
    });
  }
  return { valid: issues.filter((i) => i.severity === "error").length === 0, issues };
};

export const buildValidatedFunnelNarrativeFromValidator = (
  funnel: HistoricalFunnelIntelligence | null | undefined
): { bodyAr: string; bodyEn: string } | null => {
  if (!funnel?.sufficient) return null;
  const { valid, issues } = validateHistoricalFunnel(funnel);
  if (!valid) {
    return {
      bodyAr: `مسار المسابقة يحتاج مراجعة (${issues.length} ملاحظة).`,
      bodyEn: `Competition pipeline needs review (${issues.length} notes).`,
    };
  }
  const strong = funnel.strongestTransition;
  const weak = funnel.weakestTransition;
  if (!strong || !weak || !validateTransitionDenominator(strong)) return null;

  const strongLabel = FUNNEL_TRANSITION_PAIRS.find((p) => p.key === strong.key);
  const weakStage = HISTORICAL_FUNNEL_STAGES.find((s) => s.key === weak.to);

  return {
    bodyAr: `أقوى مرحلة: ${strongLabel?.labelAr ?? strong.key} (${strong.retention}% احتفاظ). عنق الزجاجة: ${weakStage?.labelAr ?? weak.to} (${weak.retention}%).`,
    bodyEn: `Strongest stage: ${strongLabel?.labelEn ?? strong.key} (${strong.retention}% retention). Bottleneck: ${weakStage?.labelEn ?? weak.to} (${weak.retention}%).`,
  };
};
