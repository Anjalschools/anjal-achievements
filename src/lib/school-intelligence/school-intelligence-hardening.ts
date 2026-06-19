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
  saveIntelligenceSnapshot,
} from "@/lib/school-improvement/intelligence-snapshot-store";
import {
  logSchoolIntelligenceBoot,
  SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY,
  SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
} from "@/lib/school-intelligence/school-intelligence-boot";

logSchoolIntelligenceBoot();

const SNAPSHOT_KEY = SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY;

const withRuntimeMarkers = (
  diagnostics: SchoolIntelligenceDiagnostics
): SchoolIntelligenceDiagnostics => ({
  ...diagnostics,
  runtimeVersion: SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
  buildTimestamp: new Date().toISOString(),
});

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

export const buildSchoolIntelligenceNetworkResilient = async (): Promise<SchoolIntelligenceBuildResult> => {
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
      await saveIntelligenceSnapshot({
        key: SNAPSHOT_KEY,
        domain: "school_improvement",
        kind: "full_payload",
        payload: intelligence,
      });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      warnings.push(`snapshot_save_failed:${message}`);
      console.warn("[SchoolIntelligence] snapshot save failed", message);
    }

    return {
      intelligence,
      diagnostics: withRuntimeMarkers({
        generatedAt: new Date().toISOString(),
        status: "success",
        totalDurationMs: Date.now() - buildStarted,
        steps,
        warnings: sanitizeClientWarnings(warnings),
        snapshotFallback: false,
      }),
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
      steps.push({
        step: "snapshot_fallback",
        durationMs: Date.now() - buildStarted,
        detail: "snapshot_loaded",
      });
      return {
        intelligence: cached,
        diagnostics: withRuntimeMarkers({
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
      };
    }

    return {
      intelligence: createEmptySchoolIntelligencePayload(),
      diagnostics: withRuntimeMarkers({
        generatedAt: new Date().toISOString(),
        status: "unavailable",
        totalDurationMs: Date.now() - buildStarted,
        steps,
        warnings: sanitizeClientWarnings(warnings),
        snapshotFallback: false,
        messageAr: "تعذر تحميل شبكة الذكاء المدرسي حالياً",
        messageEn: "School intelligence network is unavailable right now",
      }),
    };
  }
};

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
  });
