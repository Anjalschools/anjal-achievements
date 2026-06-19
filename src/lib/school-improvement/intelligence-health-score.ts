import type { SchoolImprovementFullDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-types";

export type IntelligenceHealthBand = "excellent" | "very_good" | "needs_attention" | "critical";

export type IntelligenceHealthScoreResult = {
  score: number;
  band: IntelligenceHealthBand;
  labelAr: string;
  labelEn: string;
  deductions: Array<{ reason: string; points: number }>;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const resolveHealthBand = (score: number): Pick<IntelligenceHealthScoreResult, "band" | "labelAr" | "labelEn"> => {
  if (score >= 95) {
    return { band: "excellent", labelAr: "ممتاز", labelEn: "Excellent" };
  }
  if (score >= 85) {
    return { band: "very_good", labelAr: "جيد جداً", labelEn: "Very good" };
  }
  if (score >= 70) {
    return { band: "needs_attention", labelAr: "يحتاج متابعة", labelEn: "Needs attention" };
  }
  return { band: "critical", labelAr: "يحتاج تدخل فوري", labelEn: "Immediate intervention" };
};

export const calculateIntelligenceHealthScore = (
  diagnostics: SchoolImprovementFullDiagnostics
): IntelligenceHealthScoreResult => {
  const deductions: Array<{ reason: string; points: number }> = [];
  let score = 100;

  const operationalSections = diagnostics.sectionReports.filter((section) => section.section !== "build");
  const totalSections = Math.max(operationalSections.length, 1);
  const healthyRatio = diagnostics.healthySections.length / totalSections;
  const sectionBase = Math.round(healthyRatio * 35);
  score = sectionBase + 65;

  for (const section of diagnostics.unavailableSections) {
    const points = 6;
    deductions.push({ reason: `unavailable:${section}`, points });
    score -= points;
  }

  const degradedSections = diagnostics.sectionReports.filter((section) => section.status === "degraded");
  for (const section of degradedSections) {
    const points = 2;
    deductions.push({ reason: `degraded:${section.section}`, points });
    score -= points;
  }

  for (const section of diagnostics.slowSections) {
    const points = 3;
    deductions.push({ reason: `slow_section:${section}`, points });
    score -= points;
  }

  for (const check of diagnostics.environment) {
    if (check.status === "failed") {
      deductions.push({ reason: `environment_failed:${check.key}`, points: 12 });
      score -= 12;
    } else if (check.status === "warning") {
      deductions.push({ reason: `environment_warning:${check.key}`, points: 4 });
      score -= 4;
    }
  }

  for (const failure of diagnostics.aggregationFailures) {
    deductions.push({ reason: `aggregation:${failure.pipelineName}`, points: 8 });
    score -= 8;
  }

  const extremeQueries = diagnostics.mongoQueries.filter((query) => query.durationMs > 5000);
  for (const query of extremeQueries) {
    deductions.push({
      reason: `slow_query:${query.collection}.${query.pipelineName || query.operation}`,
      points: 5,
    });
    score -= 5;
  }

  score = clamp(Math.round(score), 0, 100);
  return {
    score,
    ...resolveHealthBand(score),
    deductions,
  };
};
