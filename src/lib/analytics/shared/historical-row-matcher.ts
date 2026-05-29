/**
 * Shared historical row matcher — dependency leaf.
 * Pure logic; no engine imports.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalRowCategory } from "@/lib/analytics/shared/historical-row-categories";

const STAGE_FROM_LEVEL: Record<string, HistoricalRowCategory["stage"]> = {
  g1: "primary",
  g2: "primary",
  g3: "primary",
  g4: "primary",
  g5: "primary",
  g6: "primary",
  g7: "middle",
  g8: "middle",
  g9: "middle",
  g10: "secondary",
  g11: "secondary",
  g12: "secondary",
};

export const rowMatchesCategory = (
  row: ParticipationActivityRow,
  cat: HistoricalRowCategory
): boolean => {
  if (cat.key === "activity_total") return false;

  const level = String(row.levelKey || "").toLowerCase();
  const ar = row.arabicParticipants;
  const intl = row.internationalParticipants;

  const scopeMatch = cat.key.match(/^scope_(\w+)_(ar|intl)$/);
  if (scopeMatch) {
    const [, scope, sec] = scopeMatch;
    if (level !== scope) return false;
    if (sec === "ar") return ar >= intl;
    return intl > ar;
  }

  if (cat.section === "all") return true;

  const stage = STAGE_FROM_LEVEL[level];
  if (!stage || stage !== cat.stage) return false;
  if (cat.section === "arabic") return ar >= intl;
  if (cat.section === "international") return intl > ar;
  return true;
};

