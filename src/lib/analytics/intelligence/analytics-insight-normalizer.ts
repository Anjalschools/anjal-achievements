import type { ExecutiveNarrative } from "@/lib/analytics/analytics-narrative-engine";
import { createSemanticInsight, type ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import { mapLegacySeverity } from "@/lib/analytics/intelligence/analytics-insight-severity";
import { confidenceFromNumeric } from "@/lib/analytics/intelligence/analytics-insight-confidence";
import {
  CATEGORY_FROM_NARRATIVE,
  semanticTypeFromCategory,
} from "@/lib/analytics/intelligence/analytics-intelligence-taxonomy";
import {
  executivePhrase,
  softenOverclaim,
} from "@/lib/analytics/intelligence/analytics-executive-language-engine";

export const normalizeExecutiveNarrative = (
  row: ExecutiveNarrative,
  opts?: { exploratoryMode?: boolean }
): ExecutiveSemanticInsight => {
  const severity = mapLegacySeverity(row.severity);
  const confidence = confidenceFromNumeric(
    row.confidence / 100,
    opts?.exploratoryMode
  );
  const category = CATEGORY_FROM_NARRATIVE[row.category] ?? "Execution";
  const topic = row.titleAr;
  const strategicAr = softenOverclaim(
    executivePhrase(severity, topic, true, confidence),
    confidence,
    true
  );
  const strategicEn = softenOverclaim(
    executivePhrase(severity, row.titleEn, false, confidence),
    confidence,
    false
  );

  return createSemanticInsight({
    id: row.id,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    descriptionAr: row.bodyAr,
    descriptionEn: row.bodyEn,
    severity,
    confidence,
    impact: severity === "CRITICAL" ? "high" : severity === "WARNING" ? "medium" : "low",
    evidence: row.metricKeys,
    affectedDimensions: row.metricKeys,
    metricSource: row.metricKeys[0],
    generatedBy: row.registryId ?? "narrative-engine",
    semanticType: semanticTypeFromCategory(row.category),
    strategicMeaning: strategicAr,
    explorationMode: confidence === "EXPLORATORY",
    intelligenceCategory: category,
    title: row.titleAr,
    description: row.bodyAr,
  });
};

export const normalizeExecutiveNarratives = (
  rows: ExecutiveNarrative[],
  opts?: { exploratoryMode?: boolean }
): ExecutiveSemanticInsight[] => rows.map((r) => normalizeExecutiveNarrative(r, opts));
