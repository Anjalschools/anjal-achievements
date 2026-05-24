/**
 * Structured achievement outcome resolution for reports, analytics, and exports.
 * Backward compatible: infers medal/rank subtypes from legacy fields when missing.
 */

import {
  formatLocalizedResultLine,
  labelMedal,
  labelRank,
  labelResultType,
} from "@/lib/achievementDisplay";

export type OutcomeLocale = "ar" | "en";

export type MedalType = "gold" | "silver" | "bronze";
export type RankType =
  | "first"
  | "second"
  | "third"
  | "fourth"
  | "fifth"
  | "sixth"
  | "seventh"
  | "eighth"
  | "ninth"
  | "tenth"
  | "top_10"
  | "finalist";

export type AchievementOutcomeKind =
  | "participation"
  | "medal"
  | "rank"
  | "nomination"
  | "qualification"
  | "special_award"
  | "recognition"
  | "score"
  | "completion"
  | "other";

export type AchievementOutcomeInput = {
  resultType?: string;
  medalType?: string;
  rank?: string;
  resultValue?: string;
  nominationText?: string;
  specialAwardText?: string;
  description?: string;
  achievementName?: string;
  customAchievementName?: string;
  title?: string;
};

export type ResolvedAchievementOutcome = {
  kind: AchievementOutcomeKind;
  resultType: string;
  medalType: MedalType | null;
  rank: RankType | null;
  /** Stable analytics key, e.g. medal:gold, rank:first, nomination */
  outcomeKey: string;
  displayAr: string;
  displayEn: string;
  /** True when medal/rank subtype was inferred from legacy text */
  inferred: boolean;
};

const MEDAL_VALUES = new Set<MedalType>(["gold", "silver", "bronze"]);
const RANK_VALUES = new Set<RankType>([
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "top_10",
  "finalist",
]);

const safe = (v: unknown): string => String(v ?? "").trim();
const norm = (v: unknown): string =>
  safe(v)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u0600-\u06FF:_-]/g, "");

/** Normalize free-text / legacy tokens to canonical slug form. */
export const normalizeOutcomeValue = (raw: unknown): string => {
  const s = norm(raw);
  if (!s) return "";

  const medalAliases: Record<string, MedalType> = {
    gold: "gold",
    golden: "gold",
    g: "gold",
    ذهب: "gold",
    ذهبية: "gold",
    ذهبي: "gold",
    ميدالية_ذهبية: "gold",
    silver: "silver",
    s: "silver",
    فض: "silver",
    فضية: "silver",
    فضي: "silver",
    ميدالية_فضية: "silver",
    bronze: "bronze",
    b: "bronze",
    برون: "bronze",
    برونز: "bronze",
    برونزية: "bronze",
    برونزي: "bronze",
    ميدالية_برونزية: "bronze",
    copper: "bronze",
  };
  if (medalAliases[s]) return medalAliases[s];

  const rankAliases: Record<string, RankType> = {
    first: "first",
    "1st": "first",
    "1": "first",
    rank_first: "first",
    المركز_الأول: "first",
    المركز_الاول: "first",
    اول: "first",
    الأول: "first",
    second: "second",
    "2nd": "second",
    "2": "second",
    rank_second: "second",
    المركز_الثاني: "second",
    ثاني: "second",
    third: "third",
    "3rd": "third",
    "3": "third",
    rank_third: "third",
    المركز_الثالث: "third",
    ثالث: "third",
    fourth: "fourth",
    "4th": "fourth",
    "4": "fourth",
    rank_fourth: "fourth",
    المركز_الرابع: "fourth",
    fifth: "fifth",
    "5th": "fifth",
    "5": "fifth",
    rank_fifth: "fifth",
    المركز_الخامس: "fifth",
    sixth: "sixth",
    seventh: "seventh",
    eighth: "eighth",
    ninth: "ninth",
    tenth: "tenth",
    top_10: "top_10",
    top10: "top_10",
    top_10_finalists: "top_10",
    أفضل_10: "top_10",
    افضل_10: "top_10",
    finalist: "finalist",
    finalists: "finalist",
    final: "finalist",
    وصول_للنهائي: "finalist",
    النهائي: "finalist",
  };
  if (rankAliases[s]) return rankAliases[s];

  if (s.includes("medal:")) return s.split(":").slice(1).join(":");
  if (s.includes("rank:")) return s.split(":").slice(1).join(":");

  return s;
};

export const resolveMedalType = (input: AchievementOutcomeInput): MedalType | null => {
  const direct = normalizeOutcomeValue(input.medalType);
  if (MEDAL_VALUES.has(direct as MedalType)) return direct as MedalType;

  const fromValue = normalizeOutcomeValue(input.resultValue);
  if (MEDAL_VALUES.has(fromValue as MedalType)) return fromValue as MedalType;

  const hay = [
    input.resultValue,
    input.description,
    input.achievementName,
    input.customAchievementName,
    input.title,
  ]
    .map(safe)
    .join(" ")
    .toLowerCase();

  if (!hay) return null;
  if (/ذهب|gold|golden|ميدالية\s*ذهب/i.test(hay)) return "gold";
  if (/فض|silver|ميدالية\s*فض/i.test(hay)) return "silver";
  if (/برون|bronze|copper|ميدالية\s*برون/i.test(hay)) return "bronze";
  return null;
};

export const resolvePlacementType = (input: AchievementOutcomeInput): RankType | null => {
  const direct = normalizeOutcomeValue(input.rank);
  if (RANK_VALUES.has(direct as RankType)) return direct as RankType;

  const fromValue = normalizeOutcomeValue(input.resultValue);
  if (RANK_VALUES.has(fromValue as RankType)) return fromValue as RankType;

  const hay = [
    input.resultValue,
    input.description,
    input.achievementName,
    input.customAchievementName,
    input.title,
  ]
    .map(safe)
    .join(" ")
    .toLowerCase();

  if (!hay) return null;

  if (/top\s*10|أفضل\s*10|افضل\s*10|top_10/i.test(hay)) return "top_10";
  if (/finalist|finalists|النهائي|وصول\s*للنهائي/i.test(hay)) return "finalist";

  const rankPatterns: Array<[RegExp, RankType]> = [
    [/المركز\s*الأ?ول|1\s*(?:st|place)?|first\s*place|rank\s*first/i, "first"],
    [/المركز\s*الثاني|2\s*(?:nd|place)?|second\s*place|rank\s*second/i, "second"],
    [/المركز\s*الثالث|3\s*(?:rd|place)?|third\s*place|rank\s*third/i, "third"],
    [/المركز\s*الرابع|4\s*(?:th|place)?|fourth\s*place|rank\s*fourth/i, "fourth"],
    [/المركز\s*الخامس|5\s*(?:th|place)?|fifth\s*place|rank\s*fifth/i, "fifth"],
    [/المركز\s*السادس|6\s*(?:th|place)?|sixth/i, "sixth"],
    [/المركز\s*السابع|7\s*(?:th|place)?|seventh/i, "seventh"],
    [/المركز\s*الثامن|8\s*(?:th|place)?|eighth/i, "eighth"],
    [/المركز\s*التاسع|9\s*(?:th|place)?|ninth/i, "ninth"],
    [/المركز\s*العاشر|10\s*(?:th|place)?|tenth/i, "tenth"],
  ];
  for (const [rx, rank] of rankPatterns) {
    if (rx.test(hay)) return rank;
  }
  return null;
};

const isQualificationText = (text: string): boolean =>
  /تأهل|التأهل|qualified|qualification|qualifying/i.test(text);

export const inferOutcomeFromLegacyData = (
  input: AchievementOutcomeInput
): Partial<Pick<ResolvedAchievementOutcome, "kind" | "resultType" | "medalType" | "rank">> => {
  const rt = safe(input.resultType).toLowerCase() || "participation";
  const medal = resolveMedalType(input);
  const placement = resolvePlacementType(input);

  if (medal) {
    return { kind: "medal", resultType: "medal", medalType: medal, rank: null };
  }
  if (placement) {
    return { kind: "rank", resultType: "rank", rank: placement, medalType: null };
  }

  const hay = [input.resultValue, input.description, input.nominationText].map(safe).join(" ");
  if (isQualificationText(hay)) {
    return { kind: "qualification", resultType: rt === "completion" ? "completion" : "nomination" };
  }

  if (rt === "nomination" || safe(input.nominationText)) {
    return { kind: "nomination", resultType: "nomination" };
  }
  if (rt === "special_award" || safe(input.specialAwardText)) {
    return { kind: "special_award", resultType: "special_award" };
  }
  if (rt === "recognition") return { kind: "recognition", resultType: "recognition" };
  if (rt === "score") return { kind: "score", resultType: "score" };
  if (rt === "completion") return { kind: "completion", resultType: "completion" };
  if (rt === "participation") return { kind: "participation", resultType: "participation" };
  if (rt === "medal") return { kind: "medal", resultType: "medal" };
  if (rt === "rank") return { kind: "rank", resultType: "rank" };
  return { kind: "other", resultType: rt || "other" };
};

const labelExtendedRank = (rank: RankType | null, loc: OutcomeLocale): string => {
  if (!rank) return loc === "ar" ? "غير محدد" : "Not specified";
  if (rank === "top_10") return loc === "ar" ? "Top 10" : "Top 10";
  if (rank === "finalist") return loc === "ar" ? "Finalist" : "Finalist";
  return labelRank(rank, loc);
};

const buildOutcomeKey = (outcome: {
  resultType: string;
  medalType: MedalType | null;
  rank: RankType | null;
  kind: AchievementOutcomeKind;
}): string => {
  if (outcome.medalType) return `medal:${outcome.medalType}`;
  if (outcome.rank) return `rank:${outcome.rank}`;
  if (outcome.kind === "qualification") return "qualification";
  return outcome.resultType || outcome.kind || "participation";
};

export const resolveOutcomeDisplay = (
  outcome: Pick<
    ResolvedAchievementOutcome,
    "kind" | "resultType" | "medalType" | "rank"
  >,
  loc: OutcomeLocale,
  scoreValue?: number | string
): string => {
  const rt = outcome.resultType || outcome.kind;

  if (outcome.medalType || rt === "medal") {
    const m = labelMedal(outcome.medalType || undefined, loc);
    return loc === "ar" ? `ميدالية ${m}` : `${m} medal`;
  }

  if (outcome.rank || rt === "rank") {
    return labelExtendedRank(outcome.rank, loc);
  }

  if (outcome.kind === "qualification") {
    return loc === "ar" ? "تأهل" : "Qualification";
  }

  if (rt === "nomination") return labelResultType("nomination", loc);
  if (rt === "special_award") return labelResultType("special_award", loc);
  if (rt === "recognition") return labelResultType("recognition", loc);
  if (rt === "participation") return labelResultType("participation", loc);
  if (rt === "score") {
    return formatLocalizedResultLine("score", undefined, undefined, loc, scoreValue);
  }
  if (rt === "completion") return labelResultType("completion", loc);

  return formatLocalizedResultLine(rt, undefined, undefined, loc, scoreValue);
};

export const resolveAchievementOutcome = (
  input: AchievementOutcomeInput,
  scoreValue?: number | string
): ResolvedAchievementOutcome => {
  const storedMedal = safe(input.medalType);
  const storedRank = safe(input.rank);
  const inferred = inferOutcomeFromLegacyData(input);

  const medalType =
    (MEDAL_VALUES.has(storedMedal as MedalType) ? (storedMedal as MedalType) : null) ??
    inferred.medalType ??
    null;

  const rank =
    (RANK_VALUES.has(storedRank as RankType) ? (storedRank as RankType) : null) ??
    inferred.rank ??
    null;

  const resultType = inferred.resultType || safe(input.resultType) || "participation";
  let kind = inferred.kind || (resultType as AchievementOutcomeKind);

  if (medalType) {
    kind = "medal";
  } else if (rank) {
    kind = "rank";
  }

  const wasInferred =
    Boolean(medalType && !MEDAL_VALUES.has(storedMedal as MedalType)) ||
    Boolean(rank && !RANK_VALUES.has(storedRank as RankType));

  const outcomeKey = buildOutcomeKey({ kind, resultType, medalType, rank });
  const core = { kind, resultType, medalType, rank };

  return {
    ...core,
    outcomeKey,
    displayAr: resolveOutcomeDisplay(core, "ar", scoreValue),
    displayEn: resolveOutcomeDisplay(core, "en", scoreValue),
    inferred: wasInferred,
  };
};
