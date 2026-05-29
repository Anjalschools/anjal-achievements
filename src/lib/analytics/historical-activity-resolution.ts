/**
 * Historical activity resolution — strict → semantic → legacy → cross-year recovery.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import {
  HISTORICAL_ACTIVITY_TAXONOMY,
  normalizeActivitySlug,
  taxonomyById,
  type CanonicalActivityId,
  type HistoricalActivityTaxon,
} from "@/lib/analytics/historical-activity-taxonomy";
import type { ActivityFamilyDef } from "@/lib/analytics/historical-comparison-table-engine";
import { matchActivityEvolution } from "@/lib/analytics/historical-compatibility-registry";

export type ActivityMatchTier = "strict" | "semantic" | "legacy" | "evolution";

const rowText = (row: ParticipationActivityRow): string =>
  `${row.typeKey ?? ""} ${row.activityLabelAr ?? ""} ${row.activityLabelEn ?? ""} ${row.activityKey ?? ""}`.toLowerCase();

const strictMatch = (row: ParticipationActivityRow, taxon: HistoricalActivityTaxon): boolean => {
  const text = rowText(row);
  const typeKey = String(row.typeKey ?? "").toLowerCase();
  if (typeKey && taxon.typeKeys.includes(typeKey)) return true;
  return taxon.labelPatterns.some((p) => p.test(text));
};

const legacyMatch = (row: ParticipationActivityRow, taxon: HistoricalActivityTaxon): boolean => {
  const slug = normalizeActivitySlug(
    `${row.activityKey} ${row.activityLabelEn} ${row.activityLabelAr}`
  );
  return taxon.legacySlugs.some((s) => slug.includes(normalizeActivitySlug(s)));
};

const evolutionMatch = (row: ParticipationActivityRow, taxon: HistoricalActivityTaxon): boolean =>
  matchActivityEvolution(row.activityLabelAr, row.activityLabelEn, taxon.id);

export const resolveActivityForRow = (
  row: ParticipationActivityRow
): { id: CanonicalActivityId; tier: ActivityMatchTier } | null => {
  for (const taxon of HISTORICAL_ACTIVITY_TAXONOMY) {
    if (strictMatch(row, taxon)) return { id: taxon.id, tier: "strict" };
  }
  for (const taxon of HISTORICAL_ACTIVITY_TAXONOMY) {
    if (legacyMatch(row, taxon)) return { id: taxon.id, tier: "legacy" };
  }
  for (const taxon of HISTORICAL_ACTIVITY_TAXONOMY) {
    if (evolutionMatch(row, taxon)) return { id: taxon.id, tier: "evolution" };
  }
  return null;
};

export const buildFamilyRowMatcher = (familyKey: string): ((row: ParticipationActivityRow) => boolean) => {
  const taxon = taxonomyById(familyKey as CanonicalActivityId);
  if (!taxon) {
    return (row) => matchActivityEvolution(row.activityLabelAr, row.activityLabelEn, familyKey);
  }
  return (row) =>
    strictMatch(row, taxon) || legacyMatch(row, taxon) || evolutionMatch(row, taxon);
};

export const toActivityFamilyDef = (taxon: HistoricalActivityTaxon): ActivityFamilyDef => ({
  key: taxon.id,
  labelAr: taxon.labelAr,
  labelEn: taxon.labelEn,
  tableType: taxon.tableType,
  themeId: taxon.themeId,
  match: buildFamilyRowMatcher(taxon.id),
});

export const ALL_HISTORICAL_ACTIVITY_FAMILIES: ActivityFamilyDef[] =
  HISTORICAL_ACTIVITY_TAXONOMY.map(toActivityFamilyDef);

export const familyHasOutcomeSignal = (
  slices: HistoricalYearSlice[],
  familyKey: string
): boolean => {
  const match = buildFamilyRowMatcher(familyKey);
  return slices.some((s) => {
    const rows = s.payload.table.filter(match);
    return rows.some(
      (r) =>
        r.totalParticipations > 0 ||
        r.goldMedalCount > 0 ||
        r.silverMedalCount > 0 ||
        r.bronzeMedalCount > 0 ||
        r.nominationCount > 0 ||
        r.rankCount > 0 ||
        r.approvedAchievements > 0
    );
  });
};

export const detectFamiliesWithData = (
  slices: HistoricalYearSlice[],
  preferKeys?: string[]
): ActivityFamilyDef[] => {
  const withData = ALL_HISTORICAL_ACTIVITY_FAMILIES.filter((f) =>
    familyHasOutcomeSignal(slices, f.key)
  );
  if (preferKeys && preferKeys.length > 0) {
    const preferred = withData.filter((f) => preferKeys.includes(f.key));
    if (preferred.length > 0) return preferred;
  }
  return withData.length > 0 ? withData : ALL_HISTORICAL_ACTIVITY_FAMILIES.slice(0, 6);
};

export const resolveFamilyRowsForYear = (
  slice: HistoricalYearSlice,
  familyKey: string
): ParticipationActivityRow[] => {
  const match = buildFamilyRowMatcher(familyKey);
  return (slice.payload.table ?? []).filter(match);
};
