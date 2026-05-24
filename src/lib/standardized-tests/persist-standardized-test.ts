import {
  buildStandardizedTestMetadata,
  type StandardizedTestInput,
} from "@/lib/standardized-tests/standardized-test-rules";

/** Attach optional `standardizedTest` metadata to a Mongo payload (create/update). */
export const attachStandardizedTestToPayload = (
  payload: Record<string, unknown>,
  input: StandardizedTestInput
): void => {
  const meta = buildStandardizedTestMetadata(input);
  if (meta) {
    payload.standardizedTest = meta;
    if (
      (input.achievementType === "sat" ||
        input.achievementType === "ielts" ||
        input.achievementType === "toefl") &&
      meta.scoreLabel
    ) {
      payload.resultValue = meta.scoreLabel.replace(/%$/, "");
      payload.resultType = "score";
    }
    if (input.achievementType === "qudrat" && meta.scoreScale === "percentage") {
      const pct = Math.round(meta.normalizedScore ?? meta.rawScore);
      payload.qudratScore = String(pct);
    }
  }
};
