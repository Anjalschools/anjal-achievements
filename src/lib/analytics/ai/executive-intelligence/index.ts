export {
  useStableIntelligenceSectionOpen,
  readIntelligenceSectionState,
  writeIntelligenceSectionState,
} from "./stable-accordion-state";

export { buildNormalizedComparisonMatrix } from "./comparison-matrix-normalizer";
export { logMatrixDebug, isMatrixDebugEnabled, summarizeFilters } from "./matrix-debugger";

export { formatExecutiveCagr, shortenExecutiveSentence } from "./executive-wording-engine";
export { dedupeExecutiveNarratives } from "./executive-insight-dedupe";
export {
  severityFromTrend,
  severityFromAlert,
  compareSeverity,
} from "./executive-severity-ranking";

export { formatOrderedFunnelPathway } from "./executive-funnel-pathway";
