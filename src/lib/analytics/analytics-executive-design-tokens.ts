/**
 * Executive analytics design tokens — spacing, hierarchy, semantic colors, density.
 */

export const EXECUTIVE_DESIGN = {
  spacing: {
    sectionGap: "gap-4",
    cardPad: "p-4 sm:p-5",
    compactPad: "p-2 sm:p-3",
    navGap: "gap-1",
  },
  typography: {
    pageTitle: "text-lg font-black text-slate-900",
    sectionTitle: "text-sm font-black text-slate-900",
    kpiValue: "text-xl font-black tabular-nums",
    kpiLabel: "text-[10px] font-bold uppercase tracking-wide text-slate-500",
    tableHeader: "text-[9px] font-black uppercase tracking-wide",
    insightBody: "text-[11px] leading-relaxed text-slate-700",
  },
  semanticColors: {
    participation: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-800" },
    qualification: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900" },
    award: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" },
    growth: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
    decline: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900" },
    stability: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-900" },
    risk: { bg: "bg-red-50", border: "border-red-200", text: "text-red-900" },
    opportunity: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  },
  density: {
    executive: { rowHeight: 28, colMin: 52, fontSize: "text-[10px]" },
    compact: { rowHeight: 24, colMin: 44, fontSize: "text-[9px]" },
    analyst: { rowHeight: 32, colMin: 64, fontSize: "text-[11px]" },
  },
  layout: {
    maxTableWidth: "max-w-[100vw]",
    stickyNav: "sticky top-14 z-30",
    breadcrumb: "sticky top-0 z-40",
  },
} as const;

export type ExecutiveDensityMode = keyof typeof EXECUTIVE_DESIGN.density;

export const resolveDensityTokens = (mode: ExecutiveDensityMode) =>
  EXECUTIVE_DESIGN.density[mode] ?? EXECUTIVE_DESIGN.density.executive;
