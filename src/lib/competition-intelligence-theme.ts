/**
 * Institutional theme tokens — Competition Intelligence Platform (Al-Anjal).
 * Visual refinement layer; charts may import {@link ANJAL_CHART} from ./anjal-chart-theme.
 */

import { ANJAL_CHART } from "@/lib/anjal-chart-theme";

export { ANJAL_CHART };

export const CI_TYPOGRAPHY = {
  heroTitle: "text-lg sm:text-xl font-black tracking-tight text-slate-900",
  heroMeta: "text-xs font-semibold text-slate-600",
  sectionTitle: "text-sm font-black text-slate-900",
  sectionHint: "text-[11px] text-slate-500 leading-snug",
  kpiValue: "text-2xl font-black tabular-nums text-slate-900",
  kpiLabel: "text-[11px] font-bold uppercase tracking-wide text-slate-500",
  micro: "text-[10px] font-semibold text-slate-600",
} as const;

export const CI_SPACING = {
  sectionY: "space-y-3",
  sectionPad: "p-4 sm:p-5",
  gridGap: "gap-3 sm:gap-4",
  heroPad: "px-4 py-5 sm:px-6 sm:py-6",
} as const;

export const CI_SHADOW = {
  card: "shadow-sm ring-1 ring-slate-200/80",
  hero: "shadow-md ring-1 ring-slate-200/60",
  lifted: "shadow-md hover:shadow-lg transition-shadow duration-200",
} as const;

export const CI_RADIUS = {
  card: "rounded-2xl",
  chip: "rounded-lg",
  pill: "rounded-full",
} as const;

/** Subtle fills for print-friendly executive blocks */
export const CI_SURFACE = {
  hero: "bg-gradient-to-br from-slate-50 via-white to-indigo-50/30",
  decision: "bg-white",
  analyticsMuted: "bg-slate-50/50",
} as const;

export const CI_CHART = {
  gradientBarsPrimary: `linear-gradient(180deg, ${ANJAL_CHART.anjalBlue} 0%, #1e3a8a 100%)`,
  gradientBarsSuccess: `linear-gradient(180deg, ${ANJAL_CHART.successGreen} 0%, #047857 100%)`,
  gradientMedal: `linear-gradient(90deg, ${ANJAL_CHART.gold} 0%, ${ANJAL_CHART.bronze} 100%)`,
  areaFill: `${ANJAL_CHART.anjalBlue}33`,
} as const;

export const CI_DELTA_HEAT = {
  strongA: "bg-emerald-100/90 text-emerald-950",
  mildA: "bg-emerald-50 text-emerald-900",
  neutral: "bg-slate-50 text-slate-800",
  mildB: "bg-violet-50 text-violet-900",
  strongB: "bg-violet-100/90 text-violet-950",
} as const;

export const CI_ALERT_TONE = {
  risk: "border-red-200/90 bg-red-50/90 text-red-950",
  success: "border-emerald-200/90 bg-emerald-50/85 text-emerald-950",
  watch: "border-amber-200/90 bg-amber-50/85 text-amber-950",
  momentum: "border-sky-200/90 bg-sky-50/85 text-sky-950",
  segment: "border-violet-200/90 bg-violet-50/85 text-violet-950",
} as const;

export const CI_STORAGE_KEYS = {
  detailMode: "anjal-ci-detail-mode-v1",
  collapse: "anjal-ci-collapse-v1",
  pdfPreset: "anjal-ci-pdf-preset-v1",
  execSnapshot: "anjal-ci-exec-snapshot-v1",
  highContrast: "anjal-ci-high-contrast-v1",
} as const;

export type CiPdfExportPreset =
  | "full"
  | "committee"
  | "approval"
  | "leadership"
  | "mawhiba"
  | "olympiad"
  | "brief"
  | "detailed";

export const CI_PDF_PRESET_LABELS: Record<CiPdfExportPreset, { ar: string; en: string }> = {
  full: { ar: "كامل — جميع الأقسام", en: "Full — all sections" },
  committee: { ar: "تقرير لجنة", en: "Committee pack" },
  approval: { ar: "تقرير اعتماد", en: "Approval pack" },
  leadership: { ar: "قيادة مدرسية", en: "School leadership" },
  mawhiba: { ar: "موهبة", en: "Mawhiba" },
  olympiad: { ar: "أولمبياد / مسابقات", en: "Olympiad / contests" },
  brief: { ar: "مختصر تنفيذي", en: "Executive brief" },
  detailed: { ar: "تفصيلي كامل", en: "Full detail" },
};

export type ExecutivePdfSectionFlags = {
  cover: boolean;
  charts: boolean;
  medals: boolean;
  benchmarks: boolean;
  ranking: boolean;
  participants: boolean;
  studentIntel: boolean;
};

/** Which PDF blocks to emit for a given preset (rule-based, deterministic). */
export const getExecutivePdfSectionFlags = (preset: CiPdfExportPreset | undefined): ExecutivePdfSectionFlags => {
  const p = preset ?? "full";
  const full: ExecutivePdfSectionFlags = {
    cover: true,
    charts: true,
    medals: true,
    benchmarks: true,
    ranking: true,
    participants: true,
    studentIntel: true,
  };
  if (p === "brief") {
    return {
      cover: true,
      charts: false,
      medals: false,
      benchmarks: false,
      ranking: false,
      participants: false,
      studentIntel: false,
    };
  }
  if (p === "committee" || p === "approval") {
    return { ...full, studentIntel: false, charts: true };
  }
  if (p === "leadership") {
    return { ...full, studentIntel: false, charts: true, benchmarks: false, ranking: false };
  }
  if (p === "mawhiba") return { ...full, studentIntel: true };
  if (p === "olympiad") return { ...full, studentIntel: false };
  if (p === "detailed") return full;
  return full;
};
