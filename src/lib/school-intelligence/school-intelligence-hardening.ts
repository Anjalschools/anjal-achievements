import "server-only";
import { buildSchoolIntelligenceNetwork } from "@/lib/school-intelligence/school-intelligence-service";
import {
  createEmptySchoolIntelligencePayload,
  type SchoolIntelligenceBuildResult,
  type SchoolIntelligenceDiagnostics,
  type SchoolIntelligenceStepTiming,
} from "@/lib/school-intelligence/school-intelligence-diagnostics-types";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import {
  loadIntelligenceSnapshot,
  saveSchoolIntelligenceSnapshot,
} from "@/lib/school-improvement/intelligence-snapshot-store";
import {
  logSchoolIntelligenceBoot,
  SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY,
  SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
} from "@/lib/school-intelligence/school-intelligence-boot";
import {
  getSchoolIntelligenceBuildTrace,
  runWithSchoolIntelligenceBuildTrace,
  traceSchoolIntelligenceSnapshotSave,
} from "@/lib/school-intelligence/school-intelligence-section-tracer";
import {
  buildFinalReadinessDiagnostics,
  deriveIntelligenceScore,
} from "@/lib/school-intelligence/school-intelligence-final-readiness";
import { buildSchoolIntelligenceExecutiveSummary } from "@/lib/school-intelligence/school-intelligence-executive-summary";
import { buildSchoolIntelligenceDiagnosticsSchemaMeta } from "@/lib/school-intelligence/school-intelligence-diagnostics-schema";
import { buildSectionStatusMap, countSectionsByStatus } from "@/lib/school-intelligence/school-intelligence-page-utils";
import { buildHealthScoreBreakdown } from "@/lib/school-intelligence/school-intelligence-transparency-utils";

logSchoolIntelligenceBoot();

const SNAPSHOT_KEY = SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY;

const withRuntimeMarkers = (
  diagnostics: SchoolIntelligenceDiagnostics
): SchoolIntelligenceDiagnostics => ({
  ...diagnostics,
  runtimeVersion: SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
  buildTimestamp: new Date().toISOString(),
});

const attachBuildTrace = (
  diagnostics: SchoolIntelligenceDiagnostics,
  intelligence?: SchoolIntelligencePayload
): SchoolIntelligenceDiagnostics => {
  const trace = getSchoolIntelligenceBuildTrace();
  const sectionStatusMap = intelligence
    ? buildSectionStatusMap(intelligence, diagnostics.status, diagnostics.snapshotFallback)
    : buildSectionStatusMap(createEmptySchoolIntelligencePayload(), diagnostics.status, diagnostics.snapshotFallback);
  const sectionCounts = countSectionsByStatus(sectionStatusMap);
  const healthScore = buildHealthScoreBreakdown(diagnostics, sectionCounts).total;
  const intelligenceScore = deriveIntelligenceScore(intelligence ?? null, sectionStatusMap);
  const schemaMeta = buildSchoolIntelligenceDiagnosticsSchemaMeta();
  const finalReadiness = buildFinalReadinessDiagnostics({
    sectionCounts,
    healthScore,
    intelligenceScore,
    diagnostics: {
      ...diagnostics,
      talentDiscovery: trace.talentDiscovery,
      snapshotSave: trace.snapshotSave,
    },
  });

  return {
    ...diagnostics,
    firstFailure: trace.firstFailure,
    snapshotSave: trace.snapshotSave,
    querySourceMap: trace.querySourceMap,
    chunkRecovery: trace.chunkRecovery,
    bsonSerializationTraces: trace.bsonSerializationTraces,
    snapshotPayloadTrace: trace.snapshotPayloadTrace,
    snapshotPolicy: trace.snapshotPolicy,
    talentDiscovery: trace.talentDiscovery,
    finalReadiness,
    executiveSummary: intelligence
      ? buildSchoolIntelligenceExecutiveSummary({ intelligence, readiness: finalReadiness })
      : undefined,
    sectionReports: Object.fromEntries(
      Object.entries(sectionStatusMap).map(([key, status]) => [key, { status }])
    ),
    snapshotDiagnostics: {
      snapshotSave: trace.snapshotSave,
      snapshotPayloadTrace: trace.snapshotPayloadTrace,
      snapshotPolicy: trace.snapshotPolicy,
    },
    schemaVersion: schemaMeta.schemaVersion,
    schemaPolicy: schemaMeta.schemaPolicy,
  };
};

const sanitizeClientWarnings = (warnings: string[]): string[] =>
  warnings.map((warning) =>
    warning.includes("exceeded") && warning.includes("ms")
      ? "aggregation_slow_or_timeout"
      : warning
  );

const logStep = (
  tag: string,
  step: string,
  started: number,
  extra?: { documentsReturned?: number; detail?: string }
): SchoolIntelligenceStepTiming => {
  const durationMs = Date.now() - started;
  const row: SchoolIntelligenceStepTiming = {
    step,
    durationMs,
    documentsReturned: extra?.documentsReturned,
    detail: extra?.detail,
  };
  console.info(`[${tag}]`, {
    step,
    durationMs,
    documentsReturned: extra?.documentsReturned,
    detail: extra?.detail,
  });
  return row;
};

export const buildSchoolIntelligenceNetworkResilient = async (): Promise<SchoolIntelligenceBuildResult> =>
  runWithSchoolIntelligenceBuildTrace(async () => {
    const buildStarted = Date.now();
    const steps: SchoolIntelligenceStepTiming[] = [];
    const warnings: string[] = [];

    console.info("[SchoolIntelligence] build start");

    try {
      const networkStarted = Date.now();
      const intelligence = await buildSchoolIntelligenceNetwork();
      steps.push(
        logStep("SchoolIntelligence", "buildSchoolIntelligenceNetwork", networkStarted, {
          documentsReturned: intelligence.studentSuccessGraph.totalNodes,
        })
      );

      try {
        await traceSchoolIntelligenceSnapshotSave(SNAPSHOT_KEY, () =>
          saveSchoolIntelligenceSnapshot({
            payload: intelligence,
          })
        );
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : String(saveError);
        warnings.push(`snapshot_save_failed:${message}`);
        console.warn("[SchoolIntelligence] snapshot save failed", message);
      }

      return {
        intelligence,
        diagnostics: attachBuildTrace(
          withRuntimeMarkers({
            generatedAt: new Date().toISOString(),
            status: "success",
            totalDurationMs: Date.now() - buildStarted,
            steps,
            warnings: sanitizeClientWarnings(warnings),
            snapshotFallback: false,
          }),
          intelligence
        ),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(message);
      console.error("[SchoolIntelligence] build failed", message);

      let cached: SchoolIntelligencePayload | null = null;
      try {
        cached = await loadIntelligenceSnapshot<SchoolIntelligencePayload>(SNAPSHOT_KEY, "full_payload");
      } catch (loadError) {
        console.warn("[SchoolIntelligence] snapshot load failed", loadError);
      }

      if (cached) {
        console.info("[SchoolIntelligence Snapshot Hit]", {
          phase: "build_fallback",
          logicalKey: SNAPSHOT_KEY,
          generatedAt: cached.generatedAt,
        });
        steps.push({
          step: "snapshot_fallback",
          durationMs: Date.now() - buildStarted,
          detail: "snapshot_loaded",
        });
        return {
          intelligence: cached,
          diagnostics: attachBuildTrace(
            withRuntimeMarkers({
              generatedAt: new Date().toISOString(),
              status: "degraded",
              totalDurationMs: Date.now() - buildStarted,
              steps,
              warnings: sanitizeClientWarnings(warnings),
              snapshotFallback: true,
              messageAr: "تم عرض آخر نسخة ناجحة من البيانات",
              messageEn: "Showing last successful snapshot",
              timeoutSource: message.includes("exceeded") ? "achievement_intelligence" : undefined,
            }),
            cached
          ),
        };
      }

      console.warn("[SchoolIntelligence Snapshot Miss]", {
        phase: "build_fallback",
        logicalKey: SNAPSHOT_KEY,
        buildError: message,
      });

      return {
        intelligence: createEmptySchoolIntelligencePayload(),
        diagnostics: attachBuildTrace(
          withRuntimeMarkers({
            generatedAt: new Date().toISOString(),
            status: "unavailable",
            totalDurationMs: Date.now() - buildStarted,
            steps,
            warnings: sanitizeClientWarnings(warnings),
            snapshotFallback: false,
            messageAr: "تعذر تحميل شبكة الذكاء المدرسي حالياً",
            messageEn: "School intelligence network is unavailable right now",
          })
        ),
      };
    }
  });

export const buildSchoolIntelligenceApiPayload = async () => {
  const result = await buildSchoolIntelligenceNetworkResilient();
  const diagnostics = sanitizeSchoolIntelligenceDiagnostics(result.diagnostics);
  return {
    success: true as const,
    ok: true as const,
    status: diagnostics.status,
    intelligence: result.intelligence,
    diagnostics,
    messageAr: diagnostics.messageAr,
    messageEn: diagnostics.messageEn,
  };
};

export {
  createEmptySchoolIntelligencePayload,
} from "@/lib/school-intelligence/school-intelligence-diagnostics-types";

export const sanitizeSchoolIntelligenceDiagnostics = (
  diagnostics: SchoolIntelligenceDiagnostics
): SchoolIntelligenceDiagnostics =>
  withRuntimeMarkers({
    ...diagnostics,
    warnings: sanitizeClientWarnings(diagnostics.warnings),
    steps: diagnostics.steps.map((step) => ({
      ...step,
      detail: step.detail?.includes("exceeded") ? "slow_or_timeout" : step.detail,
    })),
    firstFailure: diagnostics.firstFailure,
    snapshotSave: diagnostics.snapshotSave,
    querySourceMap: diagnostics.querySourceMap,
    chunkRecovery: diagnostics.chunkRecovery,
    bsonSerializationTraces: diagnostics.bsonSerializationTraces,
    snapshotPayloadTrace: diagnostics.snapshotPayloadTrace,
    snapshotPolicy: diagnostics.snapshotPolicy,
    talentDiscovery: diagnostics.talentDiscovery,
    finalReadiness: diagnostics.finalReadiness,
    executiveSummary: diagnostics.executiveSummary,
    sectionReports: diagnostics.sectionReports,
    snapshotDiagnostics: diagnostics.snapshotDiagnostics,
    schemaVersion: diagnostics.schemaVersion,
    schemaPolicy: diagnostics.schemaPolicy,
  });
