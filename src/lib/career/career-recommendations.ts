import type { StudentAchievementSummary } from "@/lib/partnerships/build-student-achievement-summary";

export type CareerRecommendation = {
  type: "major" | "training" | "competition" | "initiative";
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  priority: "high" | "medium" | "low";
};

type RecommendationInput = {
  skills: string[];
  interests: string[];
  achievementSummary: StudentAchievementSummary;
  trainingCount: number;
  volunteerHours: number;
  grade?: string;
};

const MAJOR_RULES: Array<{
  majors: { ar: string; en: string };
  match: (skills: string[], summary: StudentAchievementSummary) => boolean;
}> = [
  {
    majors: { ar: "علوم الحاسب", en: "Computer Science" },
    match: (skills) => skills.some((s) => /python|javascript|coding|digital|برمج/i.test(s)),
  },
  {
    majors: { ar: "الهندسة", en: "Engineering" },
    match: (skills, summary) =>
      skills.some((s) => /robot|problem|math/i.test(s)) || summary.medalCount >= 2,
  },
  {
    majors: { ar: "إدارة الأعمال", en: "Business Administration" },
    match: (skills) => skills.some((s) => /leadership|project|communication/i.test(s)),
  },
  {
    majors: { ar: "الطب والعلوم الصحية", en: "Medicine & Health Sciences" },
    match: (skills, summary) =>
      skills.some((s) => /research|science/i.test(s)) || summary.participationCount >= 5,
  },
  {
    majors: { ar: "العلوم الإنسانية والإعلام", en: "Humanities & Media" },
    match: (skills) => skills.some((s) => /public speaking|communication|writing/i.test(s)),
  },
];

export const buildCareerRecommendations = (input: RecommendationInput): CareerRecommendation[] => {
  const recs: CareerRecommendation[] = [];

  for (const rule of MAJOR_RULES) {
    if (rule.match(input.skills, input.achievementSummary)) {
      recs.push({
        type: "major",
        titleAr: rule.majors.ar,
        titleEn: rule.majors.en,
        reasonAr: "يتوافق مع مهاراتك وإنجازاتك الحالية",
        reasonEn: "Aligns with your current skills and achievements",
        priority: "high",
      });
    }
  }

  if (input.trainingCount === 0) {
    recs.push({
      type: "training",
      titleAr: "التدريب الصيفي المهني",
      titleEn: "Summer professional training",
      reasonAr: "لا يوجد تدريب مسجل — يُنصح بالتقديم على فرصة تدريب",
      reasonEn: "No training on record — apply for a summer opportunity",
      priority: "high",
    });
  }

  if (input.achievementSummary.participationCount < 3) {
    recs.push({
      type: "competition",
      titleAr: "مسابقات أكاديمية",
      titleEn: "Academic competitions",
      reasonAr: "زيادة المشاركة في المسابقات تعزز الجاهزية الجامعية",
      reasonEn: "More competition participation strengthens university readiness",
      priority: "medium",
    });
  }

  if (input.volunteerHours < 20) {
    recs.push({
      type: "initiative",
      titleAr: "برامج التطوع المجتمعي",
      titleEn: "Community volunteer programs",
      reasonAr: "ساعات التطوع تعزز الملف الجامعي والمهني",
      reasonEn: "Volunteer hours strengthen your university and career profile",
      priority: "medium",
    });
  }

  for (const interest of input.interests.slice(0, 3)) {
    recs.push({
      type: "initiative",
      titleAr: `مبادرة في مجال: ${interest}`,
      titleEn: `Initiative in: ${interest}`,
      reasonAr: "مبني على اهتماماتك المسجلة",
      reasonEn: "Based on your registered interests",
      priority: "low",
    });
  }

  return recs.slice(0, 12);
};
