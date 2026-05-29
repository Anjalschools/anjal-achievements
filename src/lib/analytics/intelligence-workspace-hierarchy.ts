/**
 * Executive intelligence workspace hierarchy — layer order, density, section visibility.
 */

export type IntelligenceLayerLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type WorkspaceDensityMode = "executive" | "standard" | "deep";

export type IntelligenceNavSectionId =
  | "kpis"
  | "insights"
  | "equity"
  | "opportunities"
  | "recommendations"
  | "comparisons"
  | "tables";

export type IntelligenceSectionConfig = {
  id: string;
  navId: IntelligenceNavSectionId;
  layer: IntelligenceLayerLevel;
  anchorId: string;
  semanticTitleKey?: string;
  defaultCollapsed: boolean;
  visibleIn: WorkspaceDensityMode[];
};

export const INTELLIGENCE_LAYER_STYLES: Record<
  IntelligenceLayerLevel,
  { ring: string; badge: string; spacing: string; emphasis: string }
> = {
  1: {
    ring: "ring-2 ring-indigo-200/80",
    badge: "bg-indigo-600 text-white",
    spacing: "space-y-4",
    emphasis: "shadow-md",
  },
  2: {
    ring: "ring-1 ring-amber-200/70",
    badge: "bg-amber-500 text-white",
    spacing: "space-y-3",
    emphasis: "shadow-sm",
  },
  3: {
    ring: "ring-1 ring-violet-200/60",
    badge: "bg-violet-600 text-white",
    spacing: "space-y-3",
    emphasis: "shadow-sm",
  },
  4: {
    ring: "ring-1 ring-teal-200/60",
    badge: "bg-teal-600 text-white",
    spacing: "space-y-3",
    emphasis: "shadow-sm",
  },
  5: {
    ring: "ring-1 ring-slate-200",
    badge: "bg-slate-600 text-white",
    spacing: "space-y-2",
    emphasis: "",
  },
  6: {
    ring: "ring-1 ring-slate-100",
    badge: "bg-slate-500 text-white",
    spacing: "space-y-2",
    emphasis: "",
  },
};

export const NAV_SECTIONS: Array<{
  id: IntelligenceNavSectionId;
  anchorId: string;
  titleAr: string;
  titleEn: string;
  layer: IntelligenceLayerLevel;
}> = [
  { id: "kpis", anchorId: "intel-layer-1-kpis", titleAr: "المؤشرات", titleEn: "KPIs", layer: 1 },
  { id: "insights", anchorId: "intel-layer-2-insights", titleAr: "الرؤى", titleEn: "Insights", layer: 2 },
  { id: "equity", anchorId: "intel-layer-3-equity", titleAr: "العدالة", titleEn: "Equity", layer: 3 },
  {
    id: "opportunities",
    anchorId: "intel-layer-3-opportunity",
    titleAr: "الفرص",
    titleEn: "Opportunities",
    layer: 3,
  },
  {
    id: "recommendations",
    anchorId: "intel-layer-4-recommendations",
    titleAr: "التوصيات",
    titleEn: "Recommendations",
    layer: 4,
  },
  {
    id: "comparisons",
    anchorId: "intel-layer-5-comparison",
    titleAr: "المقارنات",
    titleEn: "Comparisons",
    layer: 5,
  },
  { id: "tables", anchorId: "intel-layer-6-tables", titleAr: "الجداول", titleEn: "Tables", layer: 6 },
];

export const DENSITY_SECTION_DEFAULTS: Record<
  WorkspaceDensityMode,
  { defaultOpenLayers: IntelligenceLayerLevel[]; maxRecommendationCards: number; expandHeatmaps: boolean }
> = {
  executive: {
    defaultOpenLayers: [1, 2, 4],
    maxRecommendationCards: 3,
    expandHeatmaps: false,
  },
  standard: {
    defaultOpenLayers: [1, 2, 3, 4],
    maxRecommendationCards: 6,
    expandHeatmaps: true,
  },
  deep: {
    defaultOpenLayers: [1, 2, 3, 4, 5, 6],
    maxRecommendationCards: 12,
    expandHeatmaps: true,
  },
};

export const isSectionVisibleInDensity = (
  layer: IntelligenceLayerLevel,
  mode: WorkspaceDensityMode
): boolean => {
  if (mode === "deep") return true;
  if (mode === "standard") return layer <= 6;
  return layer <= 4 || layer === 1;
};

export const layerDefaultCollapsed = (
  layer: IntelligenceLayerLevel,
  mode: WorkspaceDensityMode
): boolean => {
  const open = DENSITY_SECTION_DEFAULTS[mode].defaultOpenLayers;
  return !open.includes(layer);
};

export const WORKSPACE_DENSITY_STORAGE_KEY = "anjal-intel-density-v1";

export const readWorkspaceDensity = (): WorkspaceDensityMode => {
  if (typeof window === "undefined") return "standard";
  try {
    const v = localStorage.getItem(WORKSPACE_DENSITY_STORAGE_KEY);
    if (v === "executive" || v === "standard" || v === "deep") return v;
  } catch {
    /* ignore */
  }
  return "standard";
};

export const writeWorkspaceDensity = (mode: WorkspaceDensityMode): void => {
  try {
    localStorage.setItem(WORKSPACE_DENSITY_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
};
