/**
 * Single source of truth for competition intelligence aggregation logic version.
 * Bump when KPI/trend/benchmark formulas change so snapshots, exports, and audits stay traceable.
 */
export const CI_AGGREGATION_VERSION = 1;

export type CiAggregationMeta = {
  aggregationVersion: number;
  computedAt: string;
};

export const buildAggregationMeta = (): CiAggregationMeta => ({
  aggregationVersion: CI_AGGREGATION_VERSION,
  computedAt: new Date().toISOString(),
});
