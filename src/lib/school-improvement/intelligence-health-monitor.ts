import "server-only";
import connectDB from "@/lib/mongodb";
import IntelligenceHealthSnapshot from "@/models/IntelligenceHealthSnapshot";
import IntelligenceHealthAlert, {
  type IntelligenceAlertKind,
  type IntelligenceAlertLevel,
} from "@/models/IntelligenceHealthAlert";
import { calculateIntelligenceHealthScore, resolveHealthBand } from "@/lib/school-improvement/intelligence-health-score";
import { notifySystemAdminsOfCriticalAlert } from "@/lib/school-improvement/intelligence-health-notifications";
import type {
  IntelligenceFailureRecommendation,
  IntelligenceHealthMonitoringPayload,
  IntelligenceHealthTrendPoint,
  IntelligenceRootCauseLeaderboardRow,
  SchoolImprovementFullDiagnostics,
} from "@/lib/school-improvement/intelligence-diagnostics-types";
import { loadRecoveryStats } from "@/lib/school-improvement/intelligence-recovery-events";
import { calculateResilienceScore } from "@/lib/school-improvement/intelligence-resilience-score";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

const buildAlertKey = (kind: IntelligenceAlertKind, target: string) => `${kind}:${target}`;

const upsertAlert = async (input: {
  alertKey: string;
  level: IntelligenceAlertLevel;
  kind: IntelligenceAlertKind;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  service?: string;
  section?: string;
  metadata?: Record<string, unknown>;
}) => {
  const now = new Date();
  const existing = await IntelligenceHealthAlert.findOne({
    alertKey: input.alertKey,
    status: "active",
  });

  if (existing) {
    existing.lastSeenAt = now;
    existing.occurrenceCount += 1;
    existing.level = input.level;
    existing.messageAr = input.messageAr;
    existing.messageEn = input.messageEn;
    await existing.save();
    return existing;
  }

  const created = await IntelligenceHealthAlert.create({
    ...input,
    status: "active",
    firstSeenAt: now,
    lastSeenAt: now,
    occurrenceCount: 1,
  });

  await notifySystemAdminsOfCriticalAlert({
    alertKey: input.alertKey,
    level: input.level,
    titleAr: input.titleAr,
    titleEn: input.titleEn,
    messageAr: input.messageAr,
    messageEn: input.messageEn,
  });

  return created;
};

const resolveAlert = async (alertKey: string, downtimeMs: number) => {
  const active = await IntelligenceHealthAlert.findOne({ alertKey, status: "active" });
  if (!active) return null;

  const now = new Date();
  active.status = "resolved";
  active.resolvedAt = now;
  active.downtimeMs = downtimeMs;
  await active.save();

  await upsertAlert({
    alertKey: `${alertKey}:resolved:${now.getTime()}`,
    level: "info",
    kind: "recovery",
    titleAr: "تم استعادة مؤشر الذكاء",
    titleEn: "Intelligence indicator recovered",
    messageAr: `تمت استعادة ${active.section || active.service || "المؤشر"} بعد ${Math.round(downtimeMs / 1000)} ثانية.`,
    messageEn: `${active.section || active.service || "Indicator"} recovered after ${Math.round(downtimeMs / 1000)} seconds.`,
    service: active.service,
    section: active.section,
    metadata: { recoveredFrom: alertKey, downtimeMs },
  });

  return active;
};

const countConsecutiveUnavailable = async (section: string): Promise<number> => {
  const snapshots = await IntelligenceHealthSnapshot.find({})
    .sort({ timestamp: -1 })
    .limit(CONSECUTIVE_FAILURE_THRESHOLD)
    .select("unavailableSections")
    .lean();

  let streak = 0;
  for (const snapshot of snapshots) {
    if ((snapshot.unavailableSections || []).includes(section)) streak += 1;
    else break;
  }
  return streak;
};

const buildTrend = (
  snapshots: Array<{
    timestamp: Date;
    healthScore: number;
    slowQueryCount: number;
    unavailableSections: string[];
  }>,
  sinceMs: number
) => {
  const since = Date.now() - sinceMs;
  const filtered = snapshots.filter((row) => new Date(row.timestamp).getTime() >= since);

  const toPoints = (valueFn: (row: (typeof filtered)[number]) => number): IntelligenceHealthTrendPoint[] =>
    filtered
      .slice()
      .reverse()
      .map((row) => ({
        timestamp: new Date(row.timestamp).toISOString(),
        value: valueFn(row),
      }));

  return {
    healthScore: toPoints((row) => row.healthScore),
    slowQueries: toPoints((row) => row.slowQueryCount),
    unavailableSections: toPoints((row) => row.unavailableSections.length),
  };
};

const buildFailureLeaderboard = async (): Promise<IntelligenceRootCauseLeaderboardRow[]> => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const alerts = await IntelligenceHealthAlert.find({
    createdAt: { $gte: since },
    kind: { $ne: "recovery" },
  })
    .select("service section kind occurrenceCount lastSeenAt downtimeMs level")
    .lean();

  const grouped = new Map<
    string,
    { service: string; occurrences: number; lastSeenAt: Date; impactTotal: number; impactCount: number }
  >();

  for (const alert of alerts) {
    const service = String(alert.service || alert.section || "unknown-service");
    const current = grouped.get(service) || {
      service,
      occurrences: 0,
      lastSeenAt: new Date(alert.lastSeenAt),
      impactTotal: 0,
      impactCount: 0,
    };
    current.occurrences += Number(alert.occurrenceCount || 1);
    if (new Date(alert.lastSeenAt) > current.lastSeenAt) current.lastSeenAt = new Date(alert.lastSeenAt);
    if (alert.level === "critical") {
      current.impactTotal += 3;
      current.impactCount += 1;
    } else if (alert.level === "warning") {
      current.impactTotal += 2;
      current.impactCount += 1;
    } else {
      current.impactTotal += 1;
      current.impactCount += 1;
    }
    grouped.set(service, current);
  }

  return [...grouped.values()]
    .map((row) => ({
      service: row.service,
      occurrences: row.occurrences,
      lastSeenAt: row.lastSeenAt.toISOString(),
      averageImpact: row.impactCount > 0 ? Math.round((row.impactTotal / row.impactCount) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);
};

const mapAlerts = (
  alerts: Array<{
    _id: unknown;
    alertKey: string;
    level: IntelligenceAlertLevel;
    kind: IntelligenceAlertKind;
    titleAr: string;
    titleEn: string;
    messageAr: string;
    messageEn: string;
    service?: string;
    section?: string;
    status: "active" | "resolved";
    firstSeenAt: Date;
    lastSeenAt: Date;
    occurrenceCount: number;
  }>
) =>
  alerts.map((alert) => ({
    id: String(alert._id),
    alertKey: alert.alertKey,
    level: alert.level,
    kind: alert.kind,
    titleAr: alert.titleAr,
    titleEn: alert.titleEn,
    messageAr: alert.messageAr,
    messageEn: alert.messageEn,
    service: alert.service,
    section: alert.section,
    status: alert.status,
    firstSeenAt: alert.firstSeenAt.toISOString(),
    lastSeenAt: alert.lastSeenAt.toISOString(),
    occurrenceCount: alert.occurrenceCount,
  }));

export const processIntelligenceHealthMonitoring = async (
  diagnostics: SchoolImprovementFullDiagnostics
): Promise<IntelligenceHealthMonitoringPayload> => {
  await connectDB();

  const healthScoreResult = calculateIntelligenceHealthScore(diagnostics);
  const environmentStatus = Object.fromEntries(
    diagnostics.environment.map((check) => [check.key, check.status])
  ) as IntelligenceHealthMonitoringPayload["latestSnapshot"]["environmentStatus"];

  const slowQueryCount = diagnostics.mongoQueries.filter((query) => query.slow).length;
  const snapshot = await IntelligenceHealthSnapshot.create({
    timestamp: new Date(diagnostics.generatedAt),
    healthScore: healthScoreResult.score,
    healthySections: diagnostics.healthySections,
    unavailableSections: diagnostics.unavailableSections,
    slowSections: diagnostics.slowSections,
    environmentStatus,
    slowQueryCount,
    aggregationFailureCount: diagnostics.aggregationFailures.length,
    totalDurationMs: diagnostics.totalDurationMs,
  });

  await IntelligenceHealthSnapshot.deleteMany({
    timestamp: { $lt: new Date(Date.now() - RETENTION_MS) },
  });

  const previousSnapshot = await IntelligenceHealthSnapshot.find({ _id: { $ne: snapshot._id } })
    .sort({ timestamp: -1 })
    .limit(1)
    .lean();

  const previouslyUnavailable = new Set(previousSnapshot[0]?.unavailableSections || []);

  for (const section of diagnostics.unavailableSections) {
    const report = diagnostics.sectionReports.find((row) => row.section === section);
    const service = report?.service || report?.error?.service || section;
    const streak = await countConsecutiveUnavailable(section);
    const level: IntelligenceAlertLevel =
      streak >= CONSECUTIVE_FAILURE_THRESHOLD ? "critical" : "warning";
    await upsertAlert({
      alertKey: buildAlertKey("section_unavailable", section),
      level,
      kind: "section_unavailable",
      titleAr: "تعطل مؤشر ذكاء التحسين المدرسي",
      titleEn: "School improvement intelligence indicator unavailable",
      messageAr: `تعذر تحميل القسم ${section} (${service}).`,
      messageEn: `Section ${section} (${service}) is unavailable.`,
      service,
      section,
      metadata: { streak, error: report?.error?.message },
    });
  }

  for (const section of diagnostics.sectionReports.filter((row) => row.status !== "unavailable").map((row) => row.section)) {
    if (!previouslyUnavailable.has(section)) continue;
    const alertKey = buildAlertKey("section_unavailable", section);
    const active = await IntelligenceHealthAlert.findOne({ alertKey, status: "active" }).lean();
    if (!active) continue;
    const downtimeMs = Date.now() - new Date(active.firstSeenAt).getTime();
    await resolveAlert(alertKey, downtimeMs);
  }

  for (const query of diagnostics.mongoQueries.filter((row) => row.durationMs > 5000)) {
    const target = `${query.collection}.${query.pipelineName || query.operation}`;
    await upsertAlert({
      alertKey: buildAlertKey("slow_query", target),
      level: query.durationMs > 8000 ? "critical" : "warning",
      kind: "slow_query",
      titleAr: "بطء شديد في قاعدة البيانات",
      titleEn: "Severe database slowness",
      messageAr: `استعلام ${target} استغرق ${query.durationMs}ms.`,
      messageEn: `Query ${target} took ${query.durationMs}ms.`,
      service: query.collection,
      metadata: { durationMs: query.durationMs, documentsReturned: query.documentsReturned },
    });
  }

  for (const failure of diagnostics.aggregationFailures) {
    const target = `${failure.collection}.${failure.pipelineName}`;
    const repeated = await IntelligenceHealthAlert.findOne({
      alertKey: buildAlertKey("aggregation_failure", target),
      status: "active",
    }).lean();
    await upsertAlert({
      alertKey: buildAlertKey("aggregation_failure", target),
      level: repeated ? "critical" : "warning",
      kind: "aggregation_failure",
      titleAr: "فشل تجميع بيانات الذكاء",
      titleEn: "Intelligence aggregation failure",
      messageAr: `فشل ${failure.pipelineName} على ${failure.collection}.`,
      messageEn: `${failure.pipelineName} failed on ${failure.collection}.`,
      service: failure.collection,
      metadata: { error: failure.error, stageIndex: failure.stageIndex, repeated: Boolean(repeated) },
    });
  }

  for (const check of diagnostics.environment.filter((row) => row.status === "failed")) {
    await upsertAlert({
      alertKey: buildAlertKey("environment_failed", check.key),
      level: "critical",
      kind: "environment_failed",
      titleAr:
        check.key === "openai"
          ? "فشل الاتصال بخدمة OpenAI"
          : check.key === "mongodb"
            ? "فشل الاتصال بقاعدة البيانات"
            : "فشل في خدمة البيئة",
      titleEn:
        check.key === "openai"
          ? "OpenAI service connection failure"
          : check.key === "mongodb"
            ? "Database connection failure"
            : "Environment service failure",
      messageAr: check.detail || check.labelAr,
      messageEn: check.detail || check.labelEn,
      service: check.key,
      metadata: { environmentKey: check.key },
    });
  }

  if (healthScoreResult.score < 80) {
    await upsertAlert({
      alertKey: buildAlertKey("low_health_score", "overall"),
      level: healthScoreResult.score < 70 ? "critical" : "warning",
      kind: "low_health_score",
      titleAr: "انخفاض مؤشر صحة الذكاء المؤسسي",
      titleEn: "Institutional intelligence health score dropped",
      messageAr: `المؤشر الحالي ${healthScoreResult.score}/100 (${healthScoreResult.labelAr}).`,
      messageEn: `Current score ${healthScoreResult.score}/100 (${healthScoreResult.labelEn}).`,
      metadata: { score: healthScoreResult.score, band: healthScoreResult.band },
    });
  } else {
    const active = await IntelligenceHealthAlert.findOne({
      alertKey: buildAlertKey("low_health_score", "overall"),
      status: "active",
    }).lean();
    if (active) {
      await resolveAlert(
        buildAlertKey("low_health_score", "overall"),
        Date.now() - new Date(active.firstSeenAt).getTime()
      );
    }
  }

  const history = await IntelligenceHealthSnapshot.find({})
    .sort({ timestamp: -1 })
    .limit(500)
    .select("timestamp healthScore slowQueryCount unavailableSections")
    .lean();

  const activeAlerts = await IntelligenceHealthAlert.find({ status: "active" })
    .sort({ lastSeenAt: -1 })
    .limit(50)
    .lean();
  const resolvedAlerts = await IntelligenceHealthAlert.find({
    status: "resolved",
    kind: "recovery",
    resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  })
    .sort({ resolvedAt: -1 })
    .limit(20)
    .lean();

  const failureLeaderboard = await buildFailureLeaderboard();
  const { recoveryStats, resilienceScore } = await buildMonitoringSummaryExtras();
  const recommendations = buildDashboardRecommendations(failureLeaderboard, recoveryStats.mostUnstableServices);

  return {
    healthScore: healthScoreResult,
    latestSnapshot: {
      timestamp: snapshot.timestamp.toISOString(),
      healthScore: snapshot.healthScore,
      healthySections: snapshot.healthySections,
      unavailableSections: snapshot.unavailableSections,
      slowSections: snapshot.slowSections,
      environmentStatus,
    },
    alerts: mapAlerts(activeAlerts),
    recoveries: resolvedAlerts.map((alert) => ({
      id: String(alert._id),
      service: alert.service,
      section: alert.section,
      resolvedAt: alert.resolvedAt?.toISOString() || "",
      downtimeMs: alert.downtimeMs || 0,
      messageAr: alert.messageAr,
      messageEn: alert.messageEn,
    })),
    trends: {
      last24Hours: buildTrend(history, 24 * 60 * 60 * 1000),
      last7Days: buildTrend(history, 7 * 24 * 60 * 60 * 1000),
      last30Days: buildTrend(history, 30 * 24 * 60 * 60 * 1000),
    },
    failureLeaderboard,
    summary: {
      criticalCount: activeAlerts.filter((alert) => alert.level === "critical").length,
      warningCount: activeAlerts.filter((alert) => alert.level === "warning").length,
      recoveryCount: resolvedAlerts.length,
      recoveryRatePct: recoveryStats.recoveryRatePct,
      autoHealedIncidents: recoveryStats.autoHealed,
      recoveredServices: recoveryStats.recovered,
    },
    resilienceScore,
    recommendations,
    mostStableServices: recoveryStats.mostStableServices,
    mostUnstableServices: recoveryStats.mostUnstableServices,
  };
};

const buildDashboardRecommendations = (
  failureLeaderboard: IntelligenceRootCauseLeaderboardRow[],
  unstableServices: Array<{ service: string; failure: number; stability: number }>
): IntelligenceFailureRecommendation[] => {
  const recommendations: IntelligenceFailureRecommendation[] = [];

  for (const row of failureLeaderboard.slice(0, 5)) {
    recommendations.push({
      id: `failure-${row.service}`,
      priority: row.averageImpact >= 50 ? "high" : "medium",
      titleAr: `خدمة ${row.service} تحتاج متابعة`,
      titleEn: `Service ${row.service} needs attention`,
      messageAr: `تكرار الفشل ${row.occurrences} مرات — متوسط الأثر ${row.averageImpact}.`,
      messageEn: `Failed ${row.occurrences} times — average impact ${row.averageImpact}.`,
      target: row.service,
    });
  }

  for (const row of unstableServices.slice(0, 3)) {
    if (row.failure < 2) continue;
    recommendations.push({
      id: `unstable-${row.service}`,
      priority: row.stability < 50 ? "high" : "medium",
      titleAr: "خدمة غير مستقرة تحتاج متابعة",
      titleEn: "Unstable service needs attention",
      messageAr: `الخدمة ${row.service} فشلت ${row.failure} مرات — الاستقرار ${row.stability}%.`,
      messageEn: `Service ${row.service} failed ${row.failure} times — stability ${row.stability}%.`,
      target: row.service,
    });
  }

  return recommendations.slice(0, 12);
};

const buildMonitoringSummaryExtras = async () => {
  const recoveryStats = await loadRecoveryStats();
  const resilienceScore = calculateResilienceScore(recoveryStats);
  return { recoveryStats, resilienceScore };
};

export const loadIntelligenceHealthDashboard = async (): Promise<IntelligenceHealthMonitoringPayload | null> => {
  await connectDB();
  const latest = await IntelligenceHealthSnapshot.findOne({}).sort({ timestamp: -1 }).lean();
  if (!latest) return null;

  const history = await IntelligenceHealthSnapshot.find({})
    .sort({ timestamp: -1 })
    .limit(500)
    .select("timestamp healthScore slowQueryCount unavailableSections")
    .lean();

  const activeAlerts = await IntelligenceHealthAlert.find({ status: "active" })
    .sort({ lastSeenAt: -1 })
    .limit(50)
    .lean();
  const resolvedAlerts = await IntelligenceHealthAlert.find({
    status: "resolved",
    kind: "recovery",
    resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  })
    .sort({ resolvedAt: -1 })
    .limit(20)
    .lean();

  const failureLeaderboard = await buildFailureLeaderboard();
  const band = resolveHealthBand(latest.healthScore);
  const { recoveryStats, resilienceScore } = await buildMonitoringSummaryExtras();
  const recommendations = buildDashboardRecommendations(failureLeaderboard, recoveryStats.mostUnstableServices);

  return {
    healthScore: {
      score: latest.healthScore,
      band: band.band,
      labelAr: band.labelAr,
      labelEn: band.labelEn,
      deductions: [],
    },
    latestSnapshot: {
      timestamp: new Date(latest.timestamp).toISOString(),
      healthScore: latest.healthScore,
      healthySections: latest.healthySections,
      unavailableSections: latest.unavailableSections,
      slowSections: latest.slowSections,
      environmentStatus: latest.environmentStatus,
    },
    alerts: mapAlerts(activeAlerts),
    recoveries: resolvedAlerts.map((alert) => ({
      id: String(alert._id),
      service: alert.service,
      section: alert.section,
      resolvedAt: alert.resolvedAt?.toISOString() || "",
      downtimeMs: alert.downtimeMs || 0,
      messageAr: alert.messageAr,
      messageEn: alert.messageEn,
    })),
    trends: {
      last24Hours: buildTrend(history, 24 * 60 * 60 * 1000),
      last7Days: buildTrend(history, 7 * 24 * 60 * 60 * 1000),
      last30Days: buildTrend(history, 30 * 24 * 60 * 60 * 1000),
    },
    failureLeaderboard,
    summary: {
      criticalCount: activeAlerts.filter((alert) => alert.level === "critical").length,
      warningCount: activeAlerts.filter((alert) => alert.level === "warning").length,
      recoveryCount: resolvedAlerts.length,
      recoveryRatePct: recoveryStats.recoveryRatePct,
      autoHealedIncidents: recoveryStats.autoHealed,
      recoveredServices: recoveryStats.recovered,
    },
    resilienceScore,
    recommendations,
    mostStableServices: recoveryStats.mostStableServices,
    mostUnstableServices: recoveryStats.mostUnstableServices,
  };
};
