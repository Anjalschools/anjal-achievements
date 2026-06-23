import type { TalentAreaKey } from "@/lib/talent-pathway/talent-pathway-constants";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export type AchievementTrainingCorrelationInput = {
  achievementArea: TalentAreaKey;
  trainingCategory?: string;
  trainingOutcomeScore?: number;
  consistencyScore?: number;
  studentCount?: number;
};

export type AchievementTrainingPathway = {
  achievementArea: TalentAreaKey;
  trainingCategory: string;
  correlationScore: number;
  successPattern: string;
};

export type TalentCluster = {
  clusterKey: string;
  labelAr: string;
  labelEn: string;
  memberCount: number;
  averageOutcomeScore: number;
};

export type AchievementTrainingCorrelation = {
  strongestPathways: AchievementTrainingPathway[];
  recurringSuccessPatterns: string[];
  talentClusters: TalentCluster[];
};

const AREA_TO_TRAINING: Record<TalentAreaKey, string[]> = {
  technical: ["technology", "engineering"],
  research: ["research", "education", "university"],
  leadership: ["administrative", "education"],
  health: ["health"],
  engineering: ["engineering", "technology"],
  entrepreneurial: ["entrepreneurship", "administrative"],
  creative: ["education", "other"],
};

export const analyzeAchievementTrainingCorrelation = (
  rows: AchievementTrainingCorrelationInput[]
): AchievementTrainingCorrelation => {
  const pathwayMap = new Map<string, { total: number; count: number; area: TalentAreaKey; category: string }>();

  for (const row of rows) {
    const categories = row.trainingCategory
      ? [row.trainingCategory]
      : AREA_TO_TRAINING[row.achievementArea] || ["other"];
    for (const category of categories) {
      const key = `${row.achievementArea}:${category}`;
      const existing = pathwayMap.get(key) || {
        total: 0,
        count: 0,
        area: row.achievementArea,
        category,
      };
      existing.total +=
        (row.trainingOutcomeScore ?? 0) * 0.6 +
        (row.consistencyScore ?? 0) * 0.4;
      existing.count += row.studentCount ?? 1;
      pathwayMap.set(key, existing);
    }
  }

  const strongestPathways = [...pathwayMap.entries()]
    .map(([key, value]) => ({
      achievementArea: value.area,
      trainingCategory: value.category,
      correlationScore: clamp(value.total / Math.max(value.count, 1)),
      successPattern: key,
    }))
    .sort((a, b) => b.correlationScore - a.correlationScore)
    .slice(0, 8);

  const recurringSuccessPatterns = strongestPathways
    .filter((row) => row.correlationScore >= 65)
    .map((row) => `${row.achievementArea}→${row.trainingCategory}`);

  const clusterMap = new Map<string, { total: number; count: number; area: TalentAreaKey }>();
  for (const row of rows) {
    const bucket = clusterMap.get(row.achievementArea) || {
      total: 0,
      count: 0,
      area: row.achievementArea,
    };
    bucket.total += row.trainingOutcomeScore ?? 0;
    bucket.count += row.studentCount ?? 1;
    clusterMap.set(row.achievementArea, bucket);
  }

  const clusterLabels: Record<TalentAreaKey, { ar: string; en: string }> = {
    technical: { ar: "مجموعة التميز التقني", en: "Technical excellence cluster" },
    research: { ar: "مجموعة البحث والمسابقات", en: "Research & competition cluster" },
    leadership: { ar: "مجموعة القيادة والتأثير", en: "Leadership impact cluster" },
    health: { ar: "مجموعة المسارات الصحية", en: "Health pathway cluster" },
    engineering: { ar: "مجموعة الهندسة والابتكار", en: "Engineering innovation cluster" },
    entrepreneurial: { ar: "مجموعة الريادة", en: "Entrepreneurship cluster" },
    creative: { ar: "مجموعة الإبداع", en: "Creative talent cluster" },
  };

  const talentClusters = [...clusterMap.entries()]
    .map(([clusterKey, value]) => ({
      clusterKey,
      labelAr: clusterLabels[value.area]?.ar || clusterKey,
      labelEn: clusterLabels[value.area]?.en || clusterKey,
      memberCount: value.count,
      averageOutcomeScore: clamp(value.total / Math.max(value.count, 1)),
    }))
    .sort((a, b) => b.averageOutcomeScore - a.averageOutcomeScore);

  return {
    strongestPathways,
    recurringSuccessPatterns,
    talentClusters,
  };
};
