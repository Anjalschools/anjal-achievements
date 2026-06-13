import "server-only";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { getSlowRouteEntries } from "@/lib/resilience/slow-route-registry";
import { runDataQualityChecks } from "@/lib/certification/data-quality-checks";
import { runCrossSystemIntegrityChecks } from "@/lib/certification/cross-system-integrity";
import { runExportCertification } from "@/lib/certification/export-certification";
import { runBackupValidation } from "@/lib/certification/backup-validation";
import { runPerformanceCertification } from "@/lib/certification/performance-certification";
import { runAuditCoverageCheck } from "@/lib/certification/audit-coverage";
import { runSecurityReview } from "@/lib/certification/security-review";
import { collectSubsystemHealth } from "@/lib/certification/subsystem-health";
import type {
  CertificationIssue,
  PlatformCertificationPayload,
  ReadinessBreakdownRow,
} from "@/lib/certification/platform-certification-types";

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

const gradeFromScore = (score: number): PlatformCertificationPayload["readinessGrade"] => {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
};

const penalizedScore = (basePct: number, issueCount: number, penaltyPerIssue: number, maxPenalty: number) =>
  clamp(basePct - Math.min(maxPenalty, issueCount * penaltyPerIssue));

const buildReadinessBreakdown = (input: {
  subsystemOk: number;
  subsystemTotal: number;
  dataQualityIssues: number;
  integrityIssues: number;
  exportPassed: number;
  exportTotal: number;
  backupOk: boolean;
  performanceWithin: number;
  performanceTotal: number;
  auditCoveragePct: number;
  securityPassed: number;
  securityTotal: number;
}): ReadinessBreakdownRow[] => {
  const subsystemScore = input.subsystemTotal
    ? clamp((input.subsystemOk / input.subsystemTotal) * 100)
    : 100;
  const dataQualityScore = penalizedScore(100, input.dataQualityIssues, 2, 40);
  const integrityScore = penalizedScore(100, input.integrityIssues, 3, 50);
  const exportScore = input.exportTotal ? clamp((input.exportPassed / input.exportTotal) * 100) : 100;
  const backupScore = input.backupOk ? 100 : 60;
  const performanceScore = input.performanceTotal
    ? clamp((input.performanceWithin / input.performanceTotal) * 100)
    : 100;
  const auditScore = input.auditCoveragePct;
  const securityScore = input.securityTotal
    ? clamp((input.securityPassed / input.securityTotal) * 100)
    : 100;

  return [
    { area: "subsystem", labelAr: "صحة الأنظمة الفرعية", labelEn: "Subsystem health", score: subsystemScore, maxScore: 100, weight: 25 },
    { area: "data_quality", labelAr: "جودة البيانات", labelEn: "Data quality", score: dataQualityScore, maxScore: 100, weight: 20 },
    { area: "integrity", labelAr: "سلامة العلاقات", labelEn: "Cross-system integrity", score: integrityScore, maxScore: 100, weight: 20 },
    { area: "export", labelAr: "اعتماد التصدير", labelEn: "Export certification", score: exportScore, maxScore: 100, weight: 10 },
    { area: "backup", labelAr: "النسخ الاحتياطي", labelEn: "Backup validation", score: backupScore, maxScore: 100, weight: 5 },
    { area: "performance", labelAr: "الأداء", labelEn: "Performance", score: performanceScore, maxScore: 100, weight: 10 },
    { area: "audit", labelAr: "تغطية التدقيق", labelEn: "Audit coverage", score: auditScore, maxScore: 100, weight: 5 },
    { area: "security", labelAr: "المراجعة الأمنية", labelEn: "Security review", score: securityScore, maxScore: 100, weight: 5 },
  ];
};

const computeReadinessScore = (rows: ReadinessBreakdownRow[]): number => {
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = rows.reduce((s, r) => s + (r.score / r.maxScore) * r.weight, 0);
  return clamp((weighted / totalWeight) * 100);
};

const collectObservability = async (integrityIssueCount: number): Promise<PlatformCertificationPayload["observability"]> => {
  await connectDB();
  const slowRoutes = getSlowRouteEntries(20);
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const recentAuditFailures = await AuditLog.countDocuments({
    outcome: { $in: ["failure", "blocked"] },
    createdAt: { $gte: since },
  });

  const warnings: CertificationIssue[] = slowRoutes
    .filter((r) => !r.errorCode)
    .slice(0, 8)
    .map((r) => ({
      code: "slow_route",
      severity: "low",
      domain: "observability",
      messageAr: `مسار بطيء: ${r.path} (${r.durationMs}ms)`,
      messageEn: `Slow route: ${r.path} (${r.durationMs}ms)`,
    }));

  const errors: CertificationIssue[] = slowRoutes
    .filter((r) => Boolean(r.errorCode))
    .slice(0, 8)
    .map((r) => ({
      code: "route_error",
      severity: "high",
      domain: "observability",
      messageAr: `خطأ في المسار: ${r.path} — ${r.errorCode}`,
      messageEn: `Route error: ${r.path} — ${r.errorCode}`,
    }));

  if (integrityIssueCount > 0) {
    warnings.push({
      code: "integrity_violations",
      severity: integrityIssueCount > 10 ? "high" : "medium",
      domain: "observability",
      messageAr: `${integrityIssueCount} انتهاك سلامة مكتشف`,
      messageEn: `${integrityIssueCount} integrity violations detected`,
    });
  }

  return {
    slowRouteCount: slowRoutes.length,
    integrityViolationCount: integrityIssueCount,
    recentAuditFailures,
    warnings,
    errors,
  };
};

export const buildPlatformCertification = async (): Promise<PlatformCertificationPayload> => {
  const [
    subsystemHealth,
    dataQuality,
    crossSystemIntegrity,
    exportCertification,
    backupValidation,
    performance,
    auditCoverage,
    securityReview,
  ] = await Promise.all([
    collectSubsystemHealth(),
    runDataQualityChecks(),
    runCrossSystemIntegrityChecks(),
    runExportCertification(),
    runBackupValidation(),
    runPerformanceCertification(),
    runAuditCoverageCheck(),
    runSecurityReview(),
  ]);

  const subsystemOk = subsystemHealth.filter((s) => s.ok).length;
  const performanceWithin = performance.metrics.filter((m) => m.withinLimit).length;

  const readinessBreakdown = buildReadinessBreakdown({
    subsystemOk,
    subsystemTotal: subsystemHealth.length,
    dataQualityIssues: dataQuality.issueCount,
    integrityIssues: crossSystemIntegrity.issueCount,
    exportPassed: exportCertification.passed,
    exportTotal: exportCertification.tests.length,
    backupOk: backupValidation.ok && backupValidation.restoreSimulationOk,
    performanceWithin,
    performanceTotal: performance.metrics.length,
    auditCoveragePct: auditCoverage.coveragePct,
    securityPassed: securityReview.passed,
    securityTotal: securityReview.checks.length,
  });

  const readinessScore = computeReadinessScore(readinessBreakdown);
  const observability = await collectObservability(crossSystemIntegrity.issueCount + dataQuality.issueCount);

  return {
    generatedAt: new Date().toISOString(),
    readinessScore,
    readinessGrade: gradeFromScore(readinessScore),
    subsystemHealth,
    dataQuality,
    crossSystemIntegrity,
    exportCertification,
    backupValidation,
    performance,
    auditCoverage,
    securityReview,
    observability,
    readinessBreakdown,
    governance: {
      readOnly: true,
      explainable: true,
      dataSources: [
        "User",
        "Achievement",
        "StudentCareerProfile",
        "VolunteerRecord",
        "TrainingOpportunity",
        "StudentTrainingApplication",
        "TrainingCompletionRecord",
        "PartnershipProgramSettings",
        "AuditLog",
        "Notification",
        "CompetitionSnapshots",
      ],
    },
  };
};
