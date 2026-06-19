import "server-only";
import type {
  IntelligenceSectionError,
  IntelligenceSectionRecovery,
  IntelligenceSectionStatus,
} from "@/lib/school-improvement/intelligence-diagnostics-types";
import { recordIntelligenceRecoveryEvent } from "@/lib/school-improvement/intelligence-recovery-events";
import { resolveIntelligenceDomain } from "@/lib/school-improvement/intelligence-service-isolation";
import {
  loadIntelligenceSnapshot,
  saveIntelligenceSnapshot,
} from "@/lib/school-improvement/intelligence-snapshot-store";
import {
  isEmptyIntelligenceResult,
  logIntelligenceSection,
  type IntelligenceSectionHealth,
} from "@/lib/school-improvement/intelligence-section-utils";

export type { IntelligenceSectionHealth };

const RETRY_DELAYS_MS = [0, 2000, 5000] as const;
const isProduction = () => process.env.NODE_ENV === "production";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SECTION_SERVICE_MAP: Record<string, string> = {
  school_intelligence_network: "buildSchoolIntelligenceNetwork",
  student_success_graph: "buildStudentSuccessGraph",
  action_engine: "buildActionEngine",
  improvement_plans: "buildImprovementPlans",
  opportunity_recommendations: "buildOpportunityRecommendations",
  student_action_lists: "buildStudentActionLists",
  department_action_plans: "buildDepartmentActionPlans",
  institution_expansion: "buildInstitutionExpansion",
  predictive_scenarios: "buildPredictiveScenarios",
  strategic_roadmap: "buildStrategicRoadmap",
  improvement_tracking: "buildImprovementTracking",
  partnership_indicators: "buildPartnershipIntelligenceDashboard",
  summary: "buildSchoolImprovementSummary",
};

export const runResilientIntelligenceSection = async <T>(input: {
  section: string;
  logTag: string;
  fn: () => Promise<T> | T;
  fallback: T;
  sectionHealth: Record<string, IntelligenceSectionHealth>;
  warnings: string[];
  service?: string;
  isEmpty?: (value: T) => boolean;
}): Promise<T> => {
  const { section, logTag, fn, fallback, sectionHealth, warnings, service, isEmpty } = input;
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const resolvedService = service || SECTION_SERVICE_MAP[section];
  const domain = resolveIntelligenceDomain(section);
  logIntelligenceSection(logTag, section, "start");

  let retryCount = 0;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) await sleep(RETRY_DELAYS_MS[attempt]);
    try {
      const value = await fn();
      const durationMs = Date.now() - started;
      const completedAt = new Date().toISOString();
      const empty = (isEmpty || isEmptyIntelligenceResult)(value);
      const status: IntelligenceSectionStatus = empty ? "no_data" : "success";
      const recoveredAfterRetry = attempt > 0;

      if (!empty) {
        await saveIntelligenceSnapshot({
          key: section,
          domain,
          kind: "section",
          payload: value,
        });
      }

      if (recoveredAfterRetry) {
        await recordIntelligenceRecoveryEvent({
          domain,
          section,
          service: resolvedService,
          outcome: "retry_success",
          retryCount: attempt + 1,
          recoveredAfterRetry: true,
          snapshotFallback: false,
          durationMs,
          message: `Recovered on attempt ${attempt + 1}`,
        });
      }

      sectionHealth[section] = {
        status,
        startedAt,
        completedAt,
        durationMs,
        service: resolvedService,
        domain,
        recovery: {
          retryCount: attempt,
          recoveredAfterRetry,
          snapshotFallback: false,
          recoveryDurationMs: durationMs,
          outcome: recoveredAfterRetry ? "retry_success" : "live",
        },
      };

      logIntelligenceSection(logTag, section, empty ? "no_data" : "success", { durationMs });
      if (durationMs > 5000) warnings.push(`${section} exceeded 5000ms (${durationMs}ms)`);
      if (empty) warnings.push(`${section}: no_data`);
      return value;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount = attempt + 1;
      console.warn(`[SelfHealing] ${section} attempt ${attempt + 1} failed`, lastError.message);
    }
  }

  const snapshot = await loadIntelligenceSnapshot<T>(section, "section");
  const durationMs = Date.now() - started;
  const completedAt = new Date().toISOString();
  const message = lastError?.message || "Unknown error";

  if (snapshot != null) {
    await recordIntelligenceRecoveryEvent({
      domain,
      section,
      service: resolvedService,
      outcome: "snapshot_fallback",
      retryCount,
      recoveredAfterRetry: false,
      snapshotFallback: true,
      durationMs,
      message,
    });

    sectionHealth[section] = {
      status: "degraded",
      startedAt,
      completedAt,
      durationMs,
      service: resolvedService,
      domain,
      snapshotFallback: true,
      message: "تم عرض آخر نسخة ناجحة من البيانات",
      recovery: {
        retryCount,
        recoveredAfterRetry: false,
        snapshotFallback: true,
        recoveryDurationMs: durationMs,
        outcome: "snapshot_fallback",
        messageAr: "تم عرض آخر نسخة ناجحة من البيانات",
        messageEn: "Showing last successful snapshot",
      },
    };
    warnings.push(`${section}: snapshot_fallback`);
    logIntelligenceSection(logTag, section, "success", { durationMs, message: "snapshot_fallback" });
    return snapshot;
  }

  const stack = lastError?.stack;
  const sectionError: IntelligenceSectionError = {
    message,
    stack: isProduction() ? undefined : stack,
    service: resolvedService,
  };

  await recordIntelligenceRecoveryEvent({
    domain,
    section,
    service: resolvedService,
    outcome: "failed",
    retryCount,
    recoveredAfterRetry: false,
    snapshotFallback: false,
    durationMs,
    message,
  });

  sectionHealth[section] = {
    status: "unavailable",
    startedAt,
    completedAt,
    durationMs,
    message,
    stack: isProduction() ? undefined : stack,
    service: resolvedService,
    domain,
    error: sectionError,
    recovery: {
      retryCount,
      recoveredAfterRetry: false,
      snapshotFallback: false,
      recoveryDurationMs: durationMs,
      outcome: "failed",
    },
  };
  warnings.push(`${section}: ${message}`);
  logIntelligenceSection(logTag, section, "failure", { durationMs, message, stack });
  return fallback;
};

export class IntelligenceQueryTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceQueryTimeoutError";
  }
}

export const runWithQueryTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new IntelligenceQueryTimeoutError(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
