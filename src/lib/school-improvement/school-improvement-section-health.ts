import type { IntelligenceSectionHealth } from "@/lib/school-improvement/intelligence-section-utils";

export type { IntelligenceSectionHealth };

export const isSectionAvailable = (
  sectionHealth: Record<string, IntelligenceSectionHealth> | undefined,
  section: string
): boolean => {
  const status = sectionHealth?.[section]?.status;
  if (!status) return true;
  return status === "success" || status === "no_data" || status === "degraded" || status === "ok";
};

export const isSectionDegraded = (
  sectionHealth: Record<string, IntelligenceSectionHealth> | undefined,
  section: string
): boolean => sectionHealth?.[section]?.status === "degraded";

export const isSectionEmpty = (
  sectionHealth: Record<string, IntelligenceSectionHealth> | undefined,
  section: string
): boolean => sectionHealth?.[section]?.status === "no_data";

export const isSectionFailed = (
  sectionHealth: Record<string, IntelligenceSectionHealth> | undefined,
  section: string
): boolean => sectionHealth?.[section]?.status === "unavailable";

export const getSectionRecoveryMessage = (
  sectionHealth: Record<string, IntelligenceSectionHealth> | undefined,
  section: string,
  isAr: boolean
): string | null => {
  const health = sectionHealth?.[section];
  if (!health) return null;
  if (health.recovery?.messageAr || health.recovery?.messageEn) {
    return isAr
      ? health.recovery.messageAr || health.recovery.messageEn || null
      : health.recovery.messageEn || health.recovery.messageAr || null;
  }
  if (health.snapshotFallback || health.status === "degraded") {
    return isAr ? "تم عرض آخر نسخة ناجحة من البيانات" : "Showing last successful snapshot";
  }
  if (health.recovery?.recoveredAfterRetry) {
    return isAr
      ? `تمت الاستعادة تلقائياً بعد ${health.recovery.retryCount} محاولات`
      : `Auto-recovered after ${health.recovery.retryCount} retries`;
  }
  return null;
};

export const listDegradedSections = (
  sectionHealth: Record<string, IntelligenceSectionHealth> | undefined
): string[] =>
  Object.entries(sectionHealth || {})
    .filter(([, health]) => health.status === "degraded" || health.snapshotFallback)
    .map(([section]) => section);
