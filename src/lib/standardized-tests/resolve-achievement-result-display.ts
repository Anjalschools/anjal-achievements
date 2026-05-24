import { formatLocalizedResultLine } from "@/lib/achievementDisplay";
import {
  isStandardizedTestAchievement,
  resolveStandardizedScoreDisplay,
  type StandardizedTestInput,
} from "@/lib/standardized-tests/standardized-test-rules";

export type AchievementResultDisplayInput = StandardizedTestInput & {
  resultType?: string;
  medalType?: string;
  rank?: string;
};

/**
 * Unified result line for reports, exports, and cards.
 * Uses structured standardized test display when applicable — never platform `score` points.
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

  return formatLocalizedResultLine(
    rt,
    String(input.medalType || ""),
    String(input.rank || ""),
    loc,
    scoreForLine
  );
};
