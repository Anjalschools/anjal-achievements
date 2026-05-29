/**
 * competition-graph-registry.ts
 * Metadata-driven registry of competition nodes and directed edges.
 * NO hardcoded if-chains. Add new competitions here only.
 */

export type CompetitionNodeDomain =
  | "math"
  | "science"
  | "technology"
  | "research"
  | "language"
  | "gifted"
  | "stem"
  | "international";

export type CompetitionNode = {
  key: string;
  labelAr: string;
  labelEn: string;
  domains: CompetitionNodeDomain[];
  /** 1=entry-level, 5=elite international */
  tier: 1 | 2 | 3 | 4 | 5;
  minGrade: number;
  maxGrade: number;
  requiresMawhiba: boolean;
  requiresInternational: boolean;
  pathwayTags: string[];
};

export type CompetitionEdge = {
  from: string;     // node key
  to: string;       // node key
  weight: number;   // 1–10 (natural progression strength)
  conditionKey?: string; // optional rule key resolved by pathway engine
};

export const COMPETITION_NODES: CompetitionNode[] = [
  // ── Math path ──────────────────────────────────────────────────────────────
  {
    key: "bebras",
    labelAr: "بيبراس",
    labelEn: "Bebras",
    domains: ["math", "technology"],
    tier: 1,
    minGrade: 1,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["math_ladder", "stem_intro"],
  },
  {
    key: "kangaroo",
    labelAr: "كانجارو",
    labelEn: "Kangaroo",
    domains: ["math"],
    tier: 2,
    minGrade: 1,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["math_ladder"],
  },
  {
    key: "kaust_math",
    labelAr: "كاوست الرياضيات",
    labelEn: "KAUST Math",
    domains: ["math", "stem"],
    tier: 3,
    minGrade: 7,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["math_ladder", "olympiad_track"],
  },
  {
    key: "math_olympiad",
    labelAr: "أولمبياد الرياضيات",
    labelEn: "Math Olympiad",
    domains: ["math"],
    tier: 4,
    minGrade: 7,
    maxGrade: 12,
    requiresMawhiba: true,
    requiresInternational: false,
    pathwayTags: ["math_ladder", "olympiad_track", "elite"],
  },

  // ── Science/STEM path ───────────────────────────────────────────────────────
  {
    key: "mawhiba_discovery",
    labelAr: "اكتشاف موهوب",
    labelEn: "Mawhiba Discovery",
    domains: ["gifted", "stem"],
    tier: 2,
    minGrade: 4,
    maxGrade: 9,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["gifted_track", "olympiad_track"],
  },
  {
    key: "nasmo",
    labelAr: "نسمو",
    labelEn: "NASMO",
    domains: ["gifted", "science"],
    tier: 3,
    minGrade: 4,
    maxGrade: 12,
    requiresMawhiba: true,
    requiresInternational: false,
    pathwayTags: ["gifted_track", "olympiad_track"],
  },
  {
    key: "olympiad_training",
    labelAr: "ملتقيات الأولمبياد",
    labelEn: "Olympiad Camps",
    domains: ["science", "math", "stem"],
    tier: 4,
    minGrade: 7,
    maxGrade: 12,
    requiresMawhiba: true,
    requiresInternational: false,
    pathwayTags: ["olympiad_track", "elite"],
  },

  // ── Research path ───────────────────────────────────────────────────────────
  {
    key: "ibdaa",
    labelAr: "إبداع",
    labelEn: "Ibdaa",
    domains: ["research", "stem"],
    tier: 3,
    minGrade: 7,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["research_track"],
  },
  {
    key: "srsi",
    labelAr: "SRSI",
    labelEn: "SRSI",
    domains: ["research", "stem", "international"],
    tier: 5,
    minGrade: 10,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["research_track", "elite", "international_track"],
  },
  {
    key: "misk",
    labelAr: "مسك",
    labelEn: "Misk",
    domains: ["stem", "international"],
    tier: 4,
    minGrade: 10,
    maxGrade: 10,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["international_track", "research_track"],
  },

  // ── International/language path ─────────────────────────────────────────────
  {
    key: "sat",
    labelAr: "SAT",
    labelEn: "SAT",
    domains: ["language", "math", "international"],
    tier: 3,
    minGrade: 9,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: true,
    pathwayTags: ["international_track"],
  },
  {
    key: "ielts",
    labelAr: "IELTS",
    labelEn: "IELTS",
    domains: ["language", "international"],
    tier: 2,
    minGrade: 8,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["international_track", "language_track"],
  },
  {
    key: "qiyas",
    labelAr: "قدرات",
    labelEn: "Qiyas",
    domains: ["math", "language"],
    tier: 2,
    minGrade: 10,
    maxGrade: 12,
    requiresMawhiba: false,
    requiresInternational: false,
    pathwayTags: ["assessment_track"],
  },
];

/** Directed edges — from easier/earlier → harder/later */
export const COMPETITION_EDGES: CompetitionEdge[] = [
  // Math ladder
  { from: "bebras",         to: "kangaroo",          weight: 9 },
  { from: "kangaroo",       to: "kaust_math",         weight: 8 },
  { from: "kaust_math",     to: "math_olympiad",      weight: 9, conditionKey: "requires_mawhiba" },
  // Gifted → olympiad
  { from: "mawhiba_discovery", to: "nasmo",           weight: 10, conditionKey: "requires_mawhiba" },
  { from: "nasmo",          to: "olympiad_training",  weight: 9 },
  // Research track
  { from: "ibdaa",          to: "srsi",               weight: 8 },
  { from: "ibdaa",          to: "misk",               weight: 7 },
  { from: "olympiad_training", to: "ibdaa",           weight: 7 },
  // Math → Research cross-link
  { from: "kaust_math",     to: "ibdaa",              weight: 6 },
  { from: "math_olympiad",  to: "srsi",               weight: 8 },
  // International path
  { from: "ielts",          to: "sat",                weight: 7 },
  { from: "sat",            to: "srsi",               weight: 7 },
  { from: "sat",            to: "misk",               weight: 7 },
  // Assessments → competitions
  { from: "qiyas",          to: "kaust_math",         weight: 5 },
  { from: "bebras",         to: "mawhiba_discovery",  weight: 6 },
];

/** Quick lookup maps */
export const NODE_BY_KEY = new Map(COMPETITION_NODES.map((n) => [n.key, n]));
export const EDGES_FROM  = (() => {
  const m = new Map<string, CompetitionEdge[]>();
  for (const e of COMPETITION_EDGES) {
    if (!m.has(e.from)) m.set(e.from, []);
    m.get(e.from)!.push(e);
  }
  return m;
})();
export const EDGES_TO = (() => {
  const m = new Map<string, CompetitionEdge[]>();
  for (const e of COMPETITION_EDGES) {
    if (!m.has(e.to)) m.set(e.to, []);
    m.get(e.to)!.push(e);
  }
  return m;
})();
