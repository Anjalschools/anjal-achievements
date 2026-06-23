import {
  TALENT_AREAS,
  type TalentAreaKey,
} from "@/lib/talent-pathway/talent-pathway-constants";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const normalize = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export type StudentTalentProfileInput = {
  achievementCategories: string[];
  competitionCount: number;
  olympiadCount: number;
  medalCount: number;
  trainingOutcomeScore?: number;
  recommendationRatePct?: number;
  grade?: string;
  section?: string;
  targetMajors?: string[];
  careerInterests?: string[];
  trainingCategories?: string[];
};

export type TalentAreaScore = {
  key: TalentAreaKey;
  labelAr: string;
  labelEn: string;
  score: number;
};

export type StudentTalentProfile = {
  primaryTalentAreas: TalentAreaScore[];
  talentAreaScores: TalentAreaScore[];
  academicPathway: {
    grade?: string;
    section?: string;
    targetMajors: string[];
  };
};

const scoreArea = (area: (typeof TALENT_AREAS)[number], input: StudentTalentProfileInput) => {
  const corpus = normalize(
    [
      ...input.achievementCategories,
      ...(input.targetMajors || []),
      ...(input.careerInterests || []),
      ...(input.trainingCategories || []),
    ].join(" ")
  );

  let hits = 0;
  for (const signal of area.signals) {
    if (corpus.includes(normalize(signal))) hits += 1;
  }

  let score = clamp(hits * 18 + (hits > 0 ? 20 : 0));

  if (area.key === "research") {
    score = clamp(score + input.olympiadCount * 12 + (input.competitionCount >= 3 ? 10 : 0));
  }
  if (area.key === "leadership") {
    score = clamp(score + (input.medalCount >= 2 ? 8 : 0));
  }
  if (area.key === "technical" || area.key === "engineering") {
    score = clamp(score + (input.trainingOutcomeScore ?? 0) * 0.15);
  }
  if ((input.recommendationRatePct ?? 0) >= 75 && ["leadership", "entrepreneurial"].includes(area.key)) {
    score = clamp(score + 10);
  }

  return score;
};

export const buildStudentTalentProfile = (input: StudentTalentProfileInput): StudentTalentProfile => {
  const talentAreaScores: TalentAreaScore[] = TALENT_AREAS.map((area) => ({
    key: area.key,
    labelAr: area.ar,
    labelEn: area.en,
    score: scoreArea(area, input),
  })).sort((a, b) => b.score - a.score);

  const primaryTalentAreas = talentAreaScores.filter((row) => row.score >= 45).slice(0, 3);

  return {
    primaryTalentAreas: primaryTalentAreas.length > 0 ? primaryTalentAreas : talentAreaScores.slice(0, 2),
    talentAreaScores,
    academicPathway: {
      grade: input.grade,
      section: input.section,
      targetMajors: input.targetMajors || [],
    },
  };
};
