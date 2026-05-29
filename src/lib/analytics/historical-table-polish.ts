/**
 * Applies production polish pipeline to historical table models.
 */

import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { applyDynamicColumnVisibility } from "@/lib/analytics/historical-dynamic-column-visibility";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";

export const polishHistoricalTableModel = (
  model: HistoricalComparisonTableModel,
  displayMode: HistoricalTableDisplayMode = "executive"
): HistoricalComparisonTableModel =>
  applyDynamicColumnVisibility(model, displayMode, model.unifiedGraph ?? null);
