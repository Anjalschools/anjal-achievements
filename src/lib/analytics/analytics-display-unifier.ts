/**
 * Unified display resolution for review, analytics, reports, hall of fame, and exports.
 */

import {
  resolveAchievementOutcome,
  type AchievementOutcomeInput,
} from "@/lib/analytics/achievement-outcome-resolver";
import { resolveAchievementResultDisplay } from "@/lib/standardized-tests/resolve-achievement-result-display";
import { resolveCanonicalActivity } from "@/lib/analytics/activity-name-normalizer";
import { resolveDisplayAchievementCategory } from "@/lib/analytics/resolve-display-achievement-category";

export type UnifiedAchievementDisplayInput = AchievementOutcomeInput & {
  achievementType?: string | null;
  achievementCategory?: string | null;
  achievementName?: string | null;
  loc?: "ar" | "en";
};

export const resolveUnifiedAchievementDisplay = (input: UnifiedAchievementDisplayInput) => {
  const loc = input.loc ?? "ar";
  const category = resolveDisplayAchievementCategory({
    achievementType: input.achievementType ?? undefined,
    achievementCategory: input.achievementCategory ?? undefined,
    achievementName: input.achievementName ?? undefined,
  });
  const activity = resolveCanonicalActivity({
    achievementType: input.achievementType ?? undefined,
    achievementName: input.achievementName ?? undefined,
  });
  const displayInput = {
    ...input,
    achievementType: input.achievementType ?? undefined,
    achievementCategory: input.achievementCategory ?? undefined,
    achievementName: input.achievementName ?? undefined,
    resultType: input.resultType ?? undefined,
    medalType: input.medalType ?? undefined,
    rank: input.rank ?? undefined,
    resultValue: input.resultValue ?? undefined,
  };
  const outcome = resolveAchievementOutcome(displayInput);
  const resultDisplay = resolveAchievementResultDisplay(displayInput, loc);
  return { category, activity, outcome, resultDisplay, loc };
};
