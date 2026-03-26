export type ScoringConfig = {
  levelMultipliers: {
    school: number;
    province: number;
    national: number;
    international: number;
  };
  participation: Record<"school" | "province" | "national" | "international", number>;
  recognition: Record<"school" | "province" | "national" | "international", number>;
  other: Record<"school" | "province" | "national" | "international", number>;
  nomination: Record<"school" | "province" | "national" | "international", number>;
  specialAward: Record<"school" | "province" | "national" | "international", number>;
  medal: {
    gold: Record<"school" | "province" | "national" | "international", number>;
    silver: Record<"school" | "province" | "national" | "international", number>;
    bronze: Record<"school" | "province" | "national" | "international", number>;
  };
  rank: Record<
    "first" | "second" | "third" | "fourth" | "fifth" | "sixth" | "seventh" | "eighth" | "ninth" | "tenth",
    Record<"school" | "province" | "national" | "international", number>
  >;
  teamResultMultiplier: number;
  typeBonus: number;
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  levelMultipliers: {
    school: 1,
    province: 1,
    national: 1,
    international: 1,
  },
  participation: { school: 4, province: 8, national: 16, international: 32 },
  recognition: { school: 6, province: 12, national: 24, international: 48 },
  other: { school: 5, province: 10, national: 20, international: 40 },
  nomination: { school: 12, province: 24, national: 48, international: 96 },
  specialAward: { school: 24, province: 48, national: 96, international: 192 },
  medal: {
    gold: { school: 28, province: 64, national: 128, international: 256 },
    silver: { school: 24, province: 48, national: 96, international: 192 },
    bronze: { school: 18, province: 36, national: 72, international: 144 },
  },
  rank: {
    first: { school: 40, province: 80, national: 160, international: 320 },
    second: { school: 32, province: 64, national: 128, international: 256 },
    third: { school: 24, province: 48, national: 96, international: 192 },
    fourth: { school: 20, province: 40, national: 80, international: 160 },
    fifth: { school: 16, province: 32, national: 64, international: 128 },
    sixth: { school: 14, province: 28, national: 56, international: 112 },
    seventh: { school: 12, province: 24, national: 48, international: 96 },
    eighth: { school: 10, province: 20, national: 40, international: 80 },
    ninth: { school: 8, province: 16, national: 32, international: 64 },
    tenth: { school: 6, province: 12, national: 24, international: 48 },
  },
  teamResultMultiplier: 0.8,
  typeBonus: 0,
};

