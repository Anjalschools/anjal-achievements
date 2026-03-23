import { getAchievementLevelLabel } from "@/lib/achievementDisplay";

type HallLoc = "ar" | "en";

/** Canonical tiers for sorting and UI (Hall of Fame). */
export type HallTier = "international" | "national" | "regional" | "school" | "participation";

/** Priority for ranking students (higher = more prominent). */
export const HALL_LEVEL_PRIORITY: Record<HallTier, number> = {
  international: 5,
  national: 4,
  regional: 3,
  school: 2,
  participation: 1,
};

const norm = (s: string | undefined | null) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

/**
 * Map raw DB achievementLevel (and legacy synonyms) to a canonical tier.
 */
export const normalizeRawLevelToTier = (raw: string | undefined | null): HallTier => {
  const k = norm(raw);
  if (!k) return "school";
  if (["international", "global", "world"].includes(k)) return "international";
  if (["kingdom", "national"].includes(k)) return "national";
  if (
    [
      "province",
      "governorate",
      "district",
      "regional",
      "admin",
      "administration",
      "local",
      "local_authority",
    ].includes(k)
  ) {
    return "regional";
  }
  if (k === "school") return "school";
  return "school";
};

/** Tier from level field only (for ranking / badges). */
export const hallTierFromLevelsOnly = (rawLevel: string | undefined | null): HallTier =>
  normalizeRawLevelToTier(rawLevel);

/**
 * Section index for student profile (1..5). Participation-only results are listed last.
 */
export const getAchievementHallSection = (a: Record<string, unknown>): 1 | 2 | 3 | 4 | 5 => {
  if (String(a.resultType || "") === "participation") return 5;
  const t = normalizeRawLevelToTier(String(a.achievementLevel || a.level || ""));
  if (t === "international") return 1;
  if (t === "national") return 2;
  if (t === "regional") return 3;
  return 4;
};

export const highestTier = (tiers: HallTier[]): HallTier => {
  const order: HallTier[] = [
    "international",
    "national",
    "regional",
    "school",
    "participation",
  ];
  let best: HallTier = "participation";
  let bestP = -1;
  for (const t of tiers) {
    const p = HALL_LEVEL_PRIORITY[t] ?? 0;
    if (p > bestP) {
      bestP = p;
      best = t;
    }
  }
  return best;
};

/** Badge for highest tier: uses underlying achievement level label when possible. */
export const getDisplayLabelForTier = (tier: HallTier, loc: HallLoc): string => {
  const key =
    tier === "international"
      ? "international"
      : tier === "national"
        ? "kingdom"
        : tier === "regional"
          ? "province"
          : tier === "school"
            ? "school"
            : "school";
  if (tier === "participation") {
    return loc === "ar" ? "مشاركة" : "Participation";
  }
  return getAchievementLevelLabel(key, loc);
};

/** Wide photo frame border (achievement tier) — box-border + fixed image height in card */
export const hallTierPhotoBorderClass = (tier: HallTier): string => {
  switch (tier) {
    case "international":
      return "border-[6px] border-amber-400 shadow-[inset_0_0_24px_rgba(251,191,36,0.16),0_0_0_1px_rgba(251,191,36,0.28)]";
    case "national":
      return "border-[6px] border-blue-600 shadow-[inset_0_0_20px_rgba(37,99,235,0.16),0_0_0_1px_rgba(37,99,235,0.24)]";
    case "regional":
      return "border-[6px] border-emerald-500 shadow-[inset_0_0_18px_rgba(16,185,129,0.14),0_0_0_1px_rgba(16,185,129,0.24)]";
    case "school":
      return "border-[6px] border-slate-400 shadow-[inset_0_0_16px_rgba(100,116,139,0.14),0_0_0_1px_rgba(100,116,139,0.22)]";
    default:
      return "border-[6px] border-amber-300 shadow-[inset_0_0_18px_rgba(251,191,36,0.14),0_0_0_1px_rgba(251,191,36,0.22)]";
  }
};

/** Thin top accent bar on Hall of Fame cards */
export const hallTierTopAccentBarClass = (tier: HallTier): string => {
  switch (tier) {
    case "international":
      return "bg-gradient-to-l from-amber-600 via-amber-400 to-amber-600";
    case "national":
      return "bg-gradient-to-l from-blue-800 via-blue-500 to-blue-700";
    case "regional":
      return "bg-gradient-to-l from-emerald-800 via-emerald-500 to-emerald-700";
    case "school":
      return "bg-gradient-to-l from-slate-600 via-slate-400 to-slate-600";
    default:
      return "bg-gradient-to-l from-amber-500 via-amber-300 to-amber-500";
  }
};

export const hallTierCardRingClass = (tier: HallTier): string => {
  switch (tier) {
    case "international":
      return "ring-[3px] ring-amber-400/90 shadow-[0_4px_24px_-4px_rgba(251,191,36,0.4),0_0_0_1px_rgba(251,191,36,0.15)] hover:ring-amber-400 hover:shadow-[0_8px_32px_-6px_rgba(251,191,36,0.5)]";
    case "national":
      return "ring-[3px] ring-blue-600/85 shadow-[0_4px_22px_-6px_rgba(37,99,235,0.38),0_0_0_1px_rgba(37,99,235,0.12)] hover:ring-blue-600 hover:shadow-[0_8px_28px_-6px_rgba(37,99,235,0.45)]";
    case "regional":
      return "ring-[3px] ring-emerald-500/75 shadow-md hover:ring-emerald-500 hover:shadow-lg";
    case "school":
      return "ring-2 ring-slate-300/90 shadow-sm hover:ring-slate-400 hover:shadow-md";
    default:
      return "ring-2 ring-amber-200/95 shadow-sm hover:ring-amber-300 hover:shadow-md";
  }
};

export const hallTierBadgeClass = (tier: HallTier): string => {
  switch (tier) {
    case "international":
      return "bg-gradient-to-r from-amber-500 to-amber-700 text-white";
    case "national":
      return "bg-gradient-to-r from-blue-600 to-blue-800 text-white";
    case "regional":
      return "bg-gradient-to-r from-emerald-600 to-emerald-800 text-white";
    case "school":
      return "bg-slate-600 text-white";
    default:
      return "bg-amber-100 text-amber-900 border border-amber-200/80";
  }
};

export const hallTierAchievementCardClass = (tier: HallTier): { bar: string; icon: string } => {
  switch (tier) {
    case "international":
      return {
        bar: "from-violet-600/90 via-amber-500/80 to-amber-600",
        icon: "text-amber-100",
      };
    case "national":
      return { bar: "from-blue-700 to-blue-500", icon: "text-blue-50" };
    case "regional":
      return { bar: "from-emerald-700 to-emerald-500", icon: "text-emerald-50" };
    case "school":
      return { bar: "from-slate-600 to-slate-400", icon: "text-slate-50" };
    default:
      return { bar: "from-amber-600/80 to-amber-400/80", icon: "text-amber-50" };
  }
};
