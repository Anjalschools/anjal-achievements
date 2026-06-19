import "server-only";
export {
  isEmptyIntelligenceResult,
  logIntelligenceSection,
  type IntelligenceSectionHealth,
} from "@/lib/school-improvement/intelligence-section-utils";
export { runResilientIntelligenceSection as runIntelligenceSection } from "@/lib/school-improvement/intelligence-self-healing";

export type IntelligenceMetricValue<T> = {
  value: T;
  status: import("@/lib/school-improvement/intelligence-diagnostics-types").IntelligenceSectionStatus;
};

export type SchoolImprovementBuildDiagnostics = {
  totalDurationMs: number;
  sections: Record<string, import("@/lib/school-improvement/intelligence-section-utils").IntelligenceSectionHealth>;
  warnings: string[];
  slow: boolean;
};

export const wrapIntelligenceMetric = <T>(
  fn: () => T,
  fallback: T
): IntelligenceMetricValue<T> => {
  try {
    return { value: fn(), status: "success" };
  } catch {
    return { value: fallback, status: "unavailable" };
  }
};

export const buildDiagnostics = (
  sectionHealth: Record<string, import("@/lib/school-improvement/intelligence-section-utils").IntelligenceSectionHealth>,
  warnings: string[],
  totalDurationMs: number
): SchoolImprovementBuildDiagnostics => ({
  totalDurationMs,
  sections: sectionHealth,
  warnings,
  slow: totalDurationMs > 5000,
});
