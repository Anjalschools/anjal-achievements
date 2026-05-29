import type { SuggestedAction } from "@/lib/analytics/ai/ai-decision-schema";

export const prioritizeStrategicActions = (actions: SuggestedAction[]): SuggestedAction[] =>
  [...actions].sort((a, b) => b.priority - a.priority).slice(0, 24);
