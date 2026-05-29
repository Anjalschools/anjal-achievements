import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

export type AnalyticsFilterChip = {
  key: string;
  label: string;
};

export const buildAnalyticsFilterChips = (
  f: ExecutiveFilterSnapshot,
  isAr: boolean
): AnalyticsFilterChip[] => {
  const chips: AnalyticsFilterChip[] = [];

  if (f.academicYear && f.academicYear !== "all") {
    chips.push({ key: "academicYear", label: f.academicYear });
  }
  for (const y of f.activityYears) {
    chips.push({ key: `ay-${y}`, label: y });
  }
  for (const n of f.achievementNames) {
    chips.push({ key: `act-${n}`, label: n });
  }
  if (f.primaryType && f.primaryType !== "all") {
    chips.push({ key: "primaryType", label: f.primaryType });
  }
  for (const s of f.sections) {
    chips.push({
      key: `sec-${s}`,
      label: s === "international" ? (isAr ? "دولي" : "International") : isAr ? "عربي" : "Arabic",
    });
  }
  for (const m of f.mawhibaValues) {
    chips.push({
      key: `mwb-${m}`,
      label: m === "yes" ? (isAr ? "موهبة" : "Mawhiba") : isAr ? "غير موهبة" : "Non-Mawhiba",
    });
  }
  for (const g of f.genders) {
    chips.push({
      key: `g-${g}`,
      label: g === "female" ? (isAr ? "بنات" : "Girls") : isAr ? "بنين" : "Boys",
    });
  }
  for (const t of f.resultTokens) {
    const label = t.replace("medal:", isAr ? "ميدالية " : "medal ");
    chips.push({ key: `res-${t}`, label });
  }

  return chips;
};

export const buildMedalSectionScopeTitle = (
  chips: AnalyticsFilterChip[],
  isAr: boolean
): string => {
  const base = isAr ? "ذكاء الميداليات" : "Medal intelligence";
  const activity = chips.find((c) => c.key.startsWith("act-") || c.key === "primaryType");
  const years = chips.filter((c) => c.key.startsWith("ay-") || c.key === "academicYear").map((c) => c.label);
  const parts: string[] = [];
  if (activity) parts.push(activity.label);
  if (years.length) parts.push(years.join(isAr ? " · " : " · "));
  if (parts.length === 0) return base;
  return `${base} — ${parts.join(isAr ? " · " : " · ")}`;
};
