/**
 * Render budget — automatic downgrade for heavy analytics sections.
 */

export type RenderBudgetLimits = {
  maxTableRows: number;
  maxHeatmapCells: number;
  maxNarratives: number;
  maxRecommendations: number;
};

export const DEFAULT_RENDER_BUDGET: RenderBudgetLimits = {
  maxTableRows: 120,
  maxHeatmapCells: 400,
  maxNarratives: 8,
  maxRecommendations: 12,
};

export type DowngradeMode = "full" | "compact" | "minimal";

export const resolveDowngradeMode = (
  counts: Partial<Record<keyof RenderBudgetLimits, number>>,
  limits: RenderBudgetLimits = DEFAULT_RENDER_BUDGET
): DowngradeMode => {
  const over =
    (counts.maxTableRows ?? 0) > limits.maxTableRows ||
    (counts.maxHeatmapCells ?? 0) > limits.maxHeatmapCells ||
    (counts.maxNarratives ?? 0) > limits.maxNarratives ||
    (counts.maxRecommendations ?? 0) > limits.maxRecommendations;

  if (!over) return "full";
  const severe =
    (counts.maxTableRows ?? 0) > limits.maxTableRows * 2 ||
    (counts.maxHeatmapCells ?? 0) > limits.maxHeatmapCells * 2;
  return severe ? "minimal" : "compact";
};

export const clampToBudget = <T>(items: T[], max: number): T[] =>
  items.length <= max ? items : items.slice(0, max);
