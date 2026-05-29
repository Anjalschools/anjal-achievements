/**
 * Historical compatibility registry — cross-year taxonomy & metric aliases.
 */

export type HistoricalMetricAlias =
  | "participation"
  | "gold"
  | "silver"
  | "bronze"
  | "nomination"
  | "acceptance"
  | "medal_total"
  | "gifted"
  | "participated";

const METRIC_ALIASES: Record<HistoricalMetricAlias, string[]> = {
  participation: ["participation", "participated", "entry", "مشاركة", "مشارك"],
  gold: ["gold", "gold_medal", "medal_gold", "ذهبية", "ذهب"],
  silver: ["silver", "silver_medal", "medal_silver", "فضية", "فض"],
  bronze: ["bronze", "bronze_medal", "medal_bronze", "برونزية", "برونز"],
  nomination: ["nomination", "nominated", "ترشيح", "مرشح"],
  acceptance: ["acceptance", "accepted", "pass", "قبول", "اجتياز"],
  medal_total: ["medal", "medals", "medal_total", "ميدالية"],
  gifted: ["gifted", "mawhiba", "موهوب", "موهبة"],
  participated: ["participated", "participation_only", "مشاركة فقط"],
};

export const RESULT_TOKEN_ALIASES: Record<string, string[]> = {
  gold: ["gold", "medal:gold", "ذهب", "ذهبية"],
  silver: ["silver", "medal:silver", "فضة", "فضية"],
  bronze: ["bronze", "medal:bronze", "برونز", "برونزية"],
  nomination: ["nomination", "ترشيح"],
  participation: ["participation", "participation_only", "مشاركة"],
};

export const ACTIVITY_EVOLUTION_PATTERNS: Array<{ key: string; patterns: RegExp }> = [
  { key: "kangaroo", patterns: /kangaroo|كانجارو/i },
  { key: "bebras", patterns: /bebras|بيبراس/i },
  { key: "mawhiba", patterns: /mawhiba|موهبة|gifted|موهوب/i },
  { key: "sat", patterns: /\bsat\b|سات/i },
  { key: "ielts", patterns: /ielts|آيلتس/i },
  { key: "olympiad", patterns: /olympiad|أولمبياد/i },
  { key: "isef", patterns: /isef|آيسف|ibdaa|إبداع/i },
];

export const resolveMetricAlias = (token: string): HistoricalMetricAlias | null => {
  const t = token.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(METRIC_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === t)) {
      return canonical as HistoricalMetricAlias;
    }
  }
  return null;
};

export const expandResultTokens = (tokens: string[]): string[] => {
  const out = new Set<string>();
  for (const tok of tokens) {
    const key = tok.toLowerCase();
    out.add(tok);
    for (const [canonical, aliases] of Object.entries(RESULT_TOKEN_ALIASES)) {
      if (aliases.some((a) => a.toLowerCase().includes(key) || key.includes(canonical))) {
        aliases.forEach((a) => out.add(a));
      }
    }
  }
  return [...out];
};

export const matchActivityEvolution = (labelAr: string, labelEn: string, familyKey: string): boolean => {
  const text = `${labelAr} ${labelEn}`;
  const fam = ACTIVITY_EVOLUTION_PATTERNS.find((p) => p.key === familyKey);
  return fam ? fam.patterns.test(text) : false;
};

export const normalizeMedalKey = (raw: string): "gold" | "silver" | "bronze" | null => {
  const a = resolveMetricAlias(raw);
  if (a === "gold" || a === "silver" || a === "bronze") return a;
  return null;
};
