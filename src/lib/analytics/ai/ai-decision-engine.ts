/**
 * AI Decision Engine — deterministic executive decisions from analytics signals (rule-based, evidence-only).
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsInsightsBundle } from "@/lib/analytics/analytics-insights-engine";
import type { ExecutiveNarrative } from "@/lib/analytics/analytics-narrative-engine";
import type { EducationalRecommendation } from "@/lib/analytics/analytics-recommendation-engine";
import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import type { ExecutiveSnapshotKpiStrip } from "@/lib/analytics/server/analytics-snapshot-schema";
import { buildEducationalRecommendations } from "@/lib/analytics/analytics-recommendation-engine";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import type { AiDecisionEngineResult, AiDecisionBundle, ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";
import {
  normalizeFromRecommendation,
  normalizeFromSemanticInsight,
  normalizeFromAnalyticsInsight,
} from "@/lib/analytics/ai/ai-decision-normalizer";
import { dedupeDecisions } from "@/lib/analytics/ai/ai-decision-fingerprint";
import { partitionDecisionsByLayer, sortDecisionsByPriority } from "@/lib/analytics/ai/ai-decision-priority";
import { buildStrategicActionPlan } from "@/lib/analytics/ai/strategic-action-planner";
import { buildExecutiveBoardSummary } from "@/lib/analytics/ai/executive-board-summary";
import {
  aiDecisionCacheKey,
  readAiDecisionCache,
  writeAiDecisionCache,
} from "@/lib/analytics/ai/ai-decision-cache";
import { confidenceFromNumeric } from "@/lib/analytics/ai/ai-decision-confidence";
import { decisionContentFingerprint } from "@/lib/analytics/ai/ai-decision-fingerprint";
import { buildDecisionExplainability, applyExplainabilityGuardrails } from "@/lib/analytics/ai/ai-decision-explainer";
import { computeDecisionPriorityScore } from "@/lib/analytics/ai/ai-decision-priority";
import { simulateDecisionImpact } from "@/lib/analytics/ai/decision-impact-simulator";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import {
  buildOpportunityIntelligenceBundle,
  buildOpportunityExecutiveDecisions,
} from "@/lib/analytics/ai/opportunity-intelligence";

const MAX_DECISIONS = 24;

export type AiDecisionEngineInput = {
  filterFingerprint: string;
  filterScope?: string;
  general: ParticipationAnalyticsPayload | null;
  insights: AnalyticsInsightsBundle;
  narratives: ExecutiveNarrative[];
  strategicInsights: ExecutiveSemanticInsight[];
  recommendations?: EducationalRecommendation[];
  kpiStrip?: ExecutiveSnapshotKpiStrip;
  /** When provided, merges academic opportunity decisions (eligibility-aware). */
  studentIntelRows?: StudentIntelRow[];
  useCache?: boolean;
};

const buildKpiRuleDecisions = (
  general: ParticipationAnalyticsPayload | null,
  kpi: ExecutiveSnapshotKpiStrip | undefined,
  filterScope: string
): ExecutiveAiDecision[] => {
  if (!general?.ok && !kpi) return [];
  const strip = kpi ?? {
    totalParticipations: general?.kpis.totalParticipations ?? 0,
    uniqueStudents: general?.kpis.distinctStudents ?? 0,
    goldMedalCount: general?.kpis.goldMedalCount ?? 0,
    medalConversionPct: 0,
    internationalSectionPct: general?.kpis.internationalSectionPct ?? 0,
    femalePct: general?.kpis.femalePct ?? 0,
  };

  const out: ExecutiveAiDecision[] = [];

  if (strip.totalParticipations > 0 && strip.medalConversionPct < 8) {
    const partial = {
      id: "dec-kpi-medal",
      title: "رفع معدل التتويج",
      titleAr: "رفع معدل التتويج",
      titleEn: "Improve medal conversion",
      executiveSummary: `معدل التتويج ${strip.medalConversionPct}% — يحتاج تحسين جودة التحضير والمشاركة.`,
      executiveSummaryAr: `معدل التتويج ${strip.medalConversionPct}% — يحتاج تحسين جودة التحضير والمشاركة.`,
      executiveSummaryEn: `Medal rate ${strip.medalConversionPct}% — strengthen preparation and participation quality.`,
      severity: "WARNING" as const,
      confidence: confidenceFromNumeric(0.72),
      urgency: "high" as const,
      impact: "high" as const,
      evidence: [`medalConversionPct:${strip.medalConversionPct}`, `participations:${strip.totalParticipations}`],
      rationale: "KPI rule: low medal conversion",
      rationaleAr: "قاعدة KPI: معدل ميداليات منخفض",
      rationaleEn: "KPI rule: low medal conversion rate",
      affectedDimensions: ["medals", "participation"],
      suggestedActions: [
        {
          id: "act-award-coaching",
          labelAr: "برنامج تحضير للمسابقات عالية الأثر",
          labelEn: "Coaching for high-impact competitions",
          actionType: "award_improvement",
          priority: 80,
        },
      ],
      expectedOutcome: "تحسن متوقع في معدل الميداليات",
      expectedOutcomeAr: "تحسن متوقع في معدل الميداليات",
      expectedOutcomeEn: "Expected medal rate improvement",
      strategicCategory: "Awards" as const,
      timeHorizon: "short_term" as const,
      decisionType: "award_improvement" as const,
      historicalSupport: false,
      generatedAt: new Date().toISOString(),
      sourceMetrics: ["medalConversionPct"],
      sourceInsights: ["kpi-rule"],
    };
    const fingerprint = decisionContentFingerprint({
      decisionType: "award_improvement",
      titleEn: "Improve medal conversion",
      sourceInsights: ["kpi-rule"],
    });
    const base: ExecutiveAiDecision = {
      ...partial,
      fingerprint,
      priorityScore: 0,
      explainability: buildDecisionExplainability({
        decision: { ...partial, fingerprint, priorityScore: 0 },
        filterScope,
        confidence: partial.confidence,
      }),
      impactSimulation: simulateDecisionImpact({
        decision: partial,
        impact: partial.impact,
        confidence: partial.confidence,
      }),
    };
    base.priorityScore = computeDecisionPriorityScore(base);
    out.push(applyExplainabilityGuardrails(base));
  }

  if (strip.uniqueStudents > 0 && strip.totalParticipations / strip.uniqueStudents > 4.5) {
    const partial = {
      id: "dec-kpi-participation-quality",
      title: "تعميق جودة المشاركة",
      titleAr: "تعميق جودة المشاركة",
      titleEn: "Deepen participation quality",
      executiveSummary: "متوسط مشاركات مرتفع لكل طالب — ركّز على جودة النتائج لا الحجم فقط.",
      executiveSummaryAr: "متوسط مشاركات مرتفع لكل طالب — ركّز على جودة النتائج لا الحجم فقط.",
      executiveSummaryEn: "High participations per student — prioritize outcome quality over volume.",
      severity: "WATCH" as const,
      confidence: confidenceFromNumeric(0.65),
      urgency: "medium" as const,
      impact: "medium" as const,
      evidence: [`participations:${strip.totalParticipations}`, `students:${strip.uniqueStudents}`],
      rationale: "KPI: volume without proportional awards",
      rationaleAr: "مؤشر: حجم مشاركة دون تتويج متناسب",
      rationaleEn: "KPI: participation volume signal",
      affectedDimensions: ["participation"],
      suggestedActions: [],
      expectedOutcome: "توازن أفضل بين الحجم والجودة",
      expectedOutcomeAr: "توازن أفضل بين الحجم والجودة",
      expectedOutcomeEn: "Better volume-quality balance",
      strategicCategory: "Participation" as const,
      timeHorizon: "medium_term" as const,
      decisionType: "participation_recovery" as const,
      historicalSupport: false,
      generatedAt: new Date().toISOString(),
      sourceMetrics: ["avgParticipationsPerStudent"],
      sourceInsights: ["kpi-rule"],
    };
    const fingerprint = decisionContentFingerprint({
      decisionType: "participation_recovery",
      titleEn: "Deepen participation quality",
      sourceInsights: ["kpi-rule"],
    });
    const base: ExecutiveAiDecision = {
      ...partial,
      fingerprint,
      priorityScore: computeDecisionPriorityScore({ ...partial, fingerprint, priorityScore: 0 } as ExecutiveAiDecision),
      explainability: buildDecisionExplainability({
        decision: { ...partial, fingerprint, priorityScore: 0 },
        filterScope,
        confidence: partial.confidence,
      }),
      impactSimulation: simulateDecisionImpact({
        decision: partial,
        impact: partial.impact,
        confidence: partial.confidence,
      }),
    };
    out.push(applyExplainabilityGuardrails(base));
  }

  return out;
};

export const buildAiExecutiveDecisions = (input: AiDecisionEngineInput): AiDecisionEngineResult => {
  const cacheKey = aiDecisionCacheKey(input.filterFingerprint, CI_AGGREGATION_VERSION);
  if (input.useCache !== false) {
    const cached = readAiDecisionCache(cacheKey);
    if (cached) return cached;
  }

  const filterScope = input.filterScope ?? input.filterFingerprint;
  const recs =
    input.recommendations ??
    (input.general ? buildEducationalRecommendations(input.general, "participation").recommendations : []);

  const raw: ExecutiveAiDecision[] = [];

  for (const ins of input.strategicInsights) {
    raw.push(normalizeFromSemanticInsight(ins, filterScope));
  }
  for (const rec of recs) {
    raw.push(normalizeFromRecommendation(rec, filterScope));
  }
  for (const ins of input.insights.insights) {
    const d = normalizeFromAnalyticsInsight(ins, filterScope);
    if (d) raw.push(d);
  }
  raw.push(...buildKpiRuleDecisions(input.general, input.kpiStrip, filterScope));

  if (input.studentIntelRows?.length) {
    const oppBundle = buildOpportunityIntelligenceBundle(input.studentIntelRows, { maxProfiles: 12 });
    for (const profile of oppBundle.profiles.slice(0, 5)) {
      raw.push(...buildOpportunityExecutiveDecisions(profile, { maxDecisions: 2 }));
    }
    if (oppBundle.aggregate.topRecommendedKeys.length > 0) {
      const keys = oppBundle.aggregate.topRecommendedKeys.join(", ");
      raw.push({
        id: "opp-cohort-priority",
        title: "أولويات الفرص الأكاديمية",
        titleAr: "أولويات الفرص الأكاديمية",
        titleEn: "Academic opportunity priorities",
        executiveSummary: `أكثر الفرص ملاءمة ضمن العينة: ${keys}`,
        executiveSummaryAr: `أكثر الفرص ملاءمة ضمن العينة: ${keys}`,
        executiveSummaryEn: `Top cohort opportunities: ${keys}`,
        severity: "WATCH",
        confidence: confidenceFromNumeric(0.68),
        urgency: "medium",
        impact: "medium",
        evidence: [`avgReadiness:${oppBundle.aggregate.avgReadiness}`, `keys:${keys}`],
        rationale: "Cohort opportunity intelligence",
        rationaleAr: "تحليل فرص أكاديمية مبني على الأهلية والجاهزية",
        rationaleEn: "Cohort opportunity analysis from eligibility and readiness",
        affectedDimensions: ["opportunity", "cohort"],
        suggestedActions: [],
        expectedOutcome: "توجيه أكاديمي أدق للطلاب",
        expectedOutcomeAr: "توجيه أكاديمي أدق للطلاب",
        expectedOutcomeEn: "More accurate academic guidance",
        strategicCategory: "Talent",
        timeHorizon: "short_term",
        decisionType: "opportunity",
        historicalSupport: true,
        generatedAt: new Date().toISOString(),
        sourceMetrics: ["opportunity-intelligence"],
        sourceInsights: ["cohort"],
        fingerprint: `opp-cohort-${keys}`,
        priorityScore: 0,
      });
      const last = raw[raw.length - 1]!;
      last.priorityScore = computeDecisionPriorityScore(last);
    }
  }

  const decisions = sortDecisionsByPriority(dedupeDecisions(raw)).slice(0, MAX_DECISIONS);
  const layers = partitionDecisionsByLayer(decisions);

  const bundle: AiDecisionBundle = {
    generatedAt: new Date().toISOString(),
    filterFingerprint: input.filterFingerprint,
    decisions,
    ...layers,
    hasData: decisions.length > 0,
  };

  const actionPlan = buildStrategicActionPlan(decisions);
  const boardSummary = buildExecutiveBoardSummary(bundle);

  const result: AiDecisionEngineResult = { bundle, actionPlan, boardSummary };
  if (input.useCache !== false) writeAiDecisionCache(cacheKey, result);
  return result;
};
