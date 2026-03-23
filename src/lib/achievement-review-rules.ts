/**
 * Rule-based checks for achievement review (duplicate year, level consistency).
 * Deterministic — safe for production; can be combined with LLM later in achievement-ai-review.
 */

/** Normalize competition/event name for duplicate detection */
export const normalizeAchievementIdentityKey = (raw: string): string => {
  let s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u200c\u200f\u202a-\u202e]/g, "");

  const synonyms: [RegExp, string][] = [
    [/first|الأول|الاول/g, "1"],
    [/second|الثاني/g, "2"],
    [/third|الثالث/g, "3"],
    [/مسابقة|competition|olympiad|olympiad/g, ""],
  ];
  for (const [rx, rep] of synonyms) {
    s = s.replace(rx, rep);
  }
  return s.trim();
};

export const DUPLICATE_FLAG = "duplicate_same_year";
export const LEVEL_MISMATCH_FLAG = "level_mismatch";

/**
 * Known events → expected maximum plausible level (heuristic).
 * If student level ranks "higher" than reference, we flag — not auto-reject.
 */
const EVENT_EXPECTED_MAX_LEVEL: Record<string, "school" | "province" | "kingdom" | "international"> = {
  bebras: "province",
  kangaroo: "province",
  nesmo_stage_1: "province",
  nesmo_stage_2: "province",
  winter_camp: "kingdom",
  spring_camp: "kingdom",
  summer_camp: "kingdom",
  alnukhba_camp: "kingdom",
  nesmo_stage_3: "kingdom",
};

const levelRank = (lv: string): number => {
  const x = String(lv || "").toLowerCase();
  const map: Record<string, number> = {
    school: 0,
    province: 1,
    kingdom: 2,
    national: 2,
    international: 3,
  };
  return map[x] ?? -1;
};

export const checkLevelMismatchHeuristic = (
  achievementName: string,
  achievementLevel: string
): { mismatch: boolean; noteAr: string; noteEn: string } => {
  const key = String(achievementName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const expected = EVENT_EXPECTED_MAX_LEVEL[key];
  if (!expected) {
    return { mismatch: false, noteAr: "", noteEn: "" };
  }
  const aRank = levelRank(achievementLevel);
  const eRank = levelRank(expected);
  if (aRank < 0 || eRank < 0) return { mismatch: false, noteAr: "", noteEn: "" };
  // Student claims higher scope than typical for this event → flag
  if (aRank > eRank) {
    return {
      mismatch: true,
      noteAr: `المستوى المسجّل (${achievementLevel}) أعلى من المستوى الشائع لهذه الفعالية (${expected}) — يتطلب مراجعة بشرية.`,
      noteEn: `Recorded level (${achievementLevel}) is higher than the typical scope for this event (${expected}) — requires human review.`,
    };
  }
  return { mismatch: false, noteAr: "", noteEn: "" };
};

