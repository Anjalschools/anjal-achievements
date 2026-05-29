import { createHash } from "crypto";
import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";

const sortKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (Array.isArray(v)) out[k] = [...v].map(String).sort();
    else if (v && typeof v === "object") out[k] = sortKeys(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
};

export const normalizeFiltersForFingerprint = (
  filters: ParticipationAnalyticsFilters
): Record<string, unknown> => {
  const raw: Record<string, unknown> = {
    academicYear: filters.academicYear ?? "all",
    gender: filters.gender ?? "all",
    stage: filters.stage ?? "all",
    grade: filters.grade ?? "all",
    section: filters.section ?? "all",
    mawhiba: filters.mawhiba ?? "all",
    categories: filters.categories ?? [],
    levels: filters.levels ?? [],
    resultTokens: filters.resultTokens ?? [],
    domain: filters.domain ?? "",
    organization: filters.organization ?? "",
    classification: filters.classification ?? "",
    primaryAchievementType: filters.primaryAchievementType ?? "all",
    sections: filters.sections ?? [],
    genders: filters.genders ?? [],
    stages: filters.stages ?? [],
    grades: filters.grades ?? [],
    activityYears: filters.activityYears ?? [],
    achievementNames: filters.achievementNames ?? [],
    fromDate: filters.fromDate ?? "",
    toDate: filters.toDate ?? "",
    status: filters.status ?? "all",
    certificateStatus: filters.certificateStatus ?? "all",
  };
  return sortKeys(raw);
};

export const fingerprintFromParticipationFilters = (
  filters: ParticipationAnalyticsFilters
): string => {
  const canonical = JSON.stringify(normalizeFiltersForFingerprint(filters));
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
};
