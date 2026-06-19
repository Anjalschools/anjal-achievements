import "server-only";
import type {
  AggregationFailureReport,
  IntelligenceFailureRecommendation,
  MongoQueryProfile,
  SchoolImprovementFullDiagnostics,
} from "@/lib/school-improvement/intelligence-diagnostics-types";

export const buildFailurePatternRecommendations = (
  diagnostics: SchoolImprovementFullDiagnostics
): IntelligenceFailureRecommendation[] => {
  const recommendations: IntelligenceFailureRecommendation[] = [];
  const queryCounts = new Map<string, { count: number; maxMs: number }>();
  const failureCounts = new Map<string, number>();

  for (const query of diagnostics.mongoQueries) {
    const key = `${query.collection}.${query.pipelineName || query.operation}`;
    const current = queryCounts.get(key) || { count: 0, maxMs: 0 };
    current.count += 1;
    current.maxMs = Math.max(current.maxMs, query.durationMs);
    queryCounts.set(key, current);
  }

  for (const section of diagnostics.sectionReports.filter((row) => row.status === "unavailable" || row.status === "degraded")) {
    const service = section.service || section.section;
    failureCounts.set(service, (failureCounts.get(service) || 0) + 1);
  }

  for (const [key, stats] of queryCounts.entries()) {
    if (stats.maxMs <= 5000 && stats.count < 3) continue;
    if (key.startsWith("Achievement.")) {
      recommendations.push({
        id: `index-${key}`,
        priority: stats.maxMs > 8000 ? "high" : "medium",
        titleAr: "ينصح بإضافة فهرس لجدول Achievement",
        titleEn: "Consider adding an index on Achievement",
        messageAr: `استعلام ${key} بطيء (${stats.maxMs}ms) وتكرر ${stats.count} مرات.`,
        messageEn: `Query ${key} is slow (${stats.maxMs}ms) and repeated ${stats.count} times.`,
        target: key,
      });
    }
    if (key.includes("leaderboard")) {
      recommendations.push({
        id: `leaderboard-${key}`,
        priority: "high",
        titleAr: "استعلام Leaderboard يحتاج تحسين",
        titleEn: "Leaderboard query needs optimization",
        messageAr: `استعلام ${key} استغرق حتى ${stats.maxMs}ms.`,
        messageEn: `Query ${key} took up to ${stats.maxMs}ms.`,
        target: key,
      });
    }
  }

  for (const failure of diagnostics.aggregationFailures) {
    recommendations.push({
      id: `agg-${failure.pipelineName}`,
      priority: "high",
      titleAr: "فشل متكرر في تجميع البيانات",
      titleEn: "Repeated aggregation failure",
      messageAr: `خطأ في ${failure.pipelineName} على ${failure.collection}.`,
      messageEn: `Failure in ${failure.pipelineName} on ${failure.collection}.`,
      target: failure.pipelineName,
    });
  }

  for (const [service, count] of failureCounts.entries()) {
    if (count < 2) continue;
    recommendations.push({
      id: `service-${service}`,
      priority: count >= 4 ? "high" : "medium",
      titleAr: "خدمة غير مستقرة تحتاج متابعة",
      titleEn: "Unstable service needs attention",
      messageAr: `الخدمة ${service} فشلت ${count} مرات مؤخراً.`,
      messageEn: `Service ${service} failed ${count} times recently.`,
      target: service,
    });
  }

  return recommendations.slice(0, 12);
};

export const summarizeSlowQueries = (queries: MongoQueryProfile[]) =>
  [...queries]
    .filter((q) => q.slow)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

export const summarizeAggregationFailures = (failures: AggregationFailureReport[]) =>
  failures.slice(0, 10);
