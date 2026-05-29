/**
 * Semantic deduplication for executive narratives.
 */
import type { HistoricalIntelligenceNarrative } from "@/lib/analytics/historical-intelligence-narratives";

const normalizeKey = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\d+(\.\d+)?%?/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

export const dedupeExecutiveNarratives = (
  narratives: HistoricalIntelligenceNarrative[],
  max = 6
): HistoricalIntelligenceNarrative[] => {
  const seen = new Set<string>();
  const out: HistoricalIntelligenceNarrative[] = [];

  const sorted = [...narratives].sort((a, b) => b.priority - a.priority);

  for (const n of sorted) {
    const key = `${n.activityKey ?? ""}|${normalizeKey(n.bodyAr)}|${normalizeKey(n.bodyEn)}`;
    if (seen.has(key)) continue;

    const duplicateGrowth = out.some(
      (x) =>
        n.activityKey &&
        x.activityKey === n.activityKey &&
        (n.id.includes("growth") || x.id.includes("growth"))
    );
    if (duplicateGrowth) continue;

    seen.add(key);
    out.push(n);
    if (out.length >= max) break;
  }

  return out;
};
