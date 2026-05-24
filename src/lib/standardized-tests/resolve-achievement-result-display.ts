import {
  isStandardizedTestAchievement,
  resolveStandardizedScoreDisplay,
  type StandardizedTestInput,
} from "@/lib/standardized-tests/standardized-test-rules";
import {
  resolveAchievementOutcome,
  resolveOutcomeDisplay,
  type AchievementOutcomeInput,
} from "@/lib/analytics/achievement-outcome-resolver";

export type AchievementResultDisplayInput = StandardizedTestInput &
  AchievementOutcomeInput;

/**
 * Unified result line for reports, exports, and cards.
 * Uses structured standardized test display when applicable — never platform `score` points.
 * Otherwise resolves medal/rank/nomination outcomes via achievement-outcome-resolver.
 */
export const resolveAchievementResultDisplay = (
  input: AchievementResultDisplayInput,
  loc: "ar" | "en"
): string => {
  if (isStandardizedTestAchievement(input)) {
    const std = resolveStandardizedScoreDisplay(input, loc);
    if (std?.isValid) return loc === "ar" ? std.displayAr : std.displayEn;
    if (std && !std.isValid && std.scoreScale === "participation") {
      return loc === "ar" ? std.displayAr : std.displayEn;
    }
  }

  const rt = String(input.resultType || "");
  const rv = input.resultValue;
  const scoreForLine =
    rt === "score" && rv != null && String(rv).trim() !== ""
      ? String(rv).trim()
      : undefined;

  const outcome = resolveAchievementOutcome(input, scoreForLine);
  return loc === "ar" ? outcome.displayAr : outcome.displayEn;
};

export { resolveAchievementOutcome, resolveOutcomeDisplay };
