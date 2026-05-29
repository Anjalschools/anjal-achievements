/**
 * Unified competition analytics payload — single source of truth for UI, KPIs, exports.
 */
import type { CompetitionTableModel } from "@/lib/analytics/competition-table-engine";

export type UnifiedCompetitionAnalyticsPayload = {
  competitionKey: string;
  years: number[];
  model: CompetitionTableModel;
  queryKey: string;
  generatedAt: string;
};

export const buildUnifiedCompetitionPayload = (input: {
  competitionKey: string;
  years: number[];
  model: CompetitionTableModel;
  queryKey: string;
}): UnifiedCompetitionAnalyticsPayload => ({
  competitionKey: input.competitionKey,
  years: input.years,
  model: input.model,
  queryKey: input.queryKey,
  generatedAt: input.model.generatedAt,
});
