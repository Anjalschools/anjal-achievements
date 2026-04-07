/**
 * Local verification for achievement scoring (run: npx tsx scripts/verify-achievement-scoring.ts).
 * Uses DEFAULT platform scoring — must match admin defaults.
 */
import { calculateAchievementScore } from "../src/lib/achievement-scoring";
import { DEFAULT_SCORING_CONFIG } from "../src/constants/default-scoring";

const cfg = DEFAULT_SCORING_CONFIG;

const assertScore = (label: string, expected: number, input: Parameters<typeof calculateAchievementScore>[0]) => {
  const r = calculateAchievementScore({ ...input, scoringConfig: cfg });
  if (r.score !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${r.score}`, r.scoreBreakdown, r.validationErrors);
    process.exitCode = 1;
    return;
  }
  console.log(`OK: ${label} → ${r.score}`);
};

assertScore("Silver + international + individual", 192, {
  achievementType: "competition",
  achievementLevel: "international",
  resultType: "medal",
  medalType: "silver",
  participationType: "individual",
});

assertScore("Third + kingdom + individual", 96, {
  achievementType: "competition",
  achievementLevel: "kingdom",
  resultType: "rank",
  rank: "third",
  participationType: "individual",
});

assertScore("Special award + kingdom + individual", 96, {
  achievementType: "competition",
  achievementLevel: "kingdom",
  resultType: "special_award",
  participationType: "individual",
});

assertScore("Tenth + kingdom + individual", 24, {
  achievementType: "competition",
  achievementLevel: "kingdom",
  resultType: "rank",
  rank: "tenth",
  participationType: "individual",
});

assertScore("Nomination + kingdom + individual", 48, {
  achievementType: "competition",
  achievementLevel: "kingdom",
  resultType: "nomination",
  participationType: "individual",
});

assertScore("First + kingdom + team", 128, {
  achievementType: "competition",
  achievementLevel: "kingdom",
  resultType: "rank",
  rank: "first",
  participationType: "team",
});

assertScore("Special award + kingdom + team", 77, {
  achievementType: "competition",
  achievementLevel: "kingdom",
  resultType: "special_award",
  participationType: "team",
});

assertScore("Participation + school + individual", 4, {
  achievementType: "competition",
  achievementLevel: "school",
  resultType: "participation",
  participationType: "individual",
});

assertScore("Participation + kingdom + individual", 16, {
  achievementType: "competition",
  achievementLevel: "kingdom",
  resultType: "participation",
  participationType: "individual",
});

if (process.exitCode === 1) {
  process.exit(1);
}
