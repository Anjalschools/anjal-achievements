import type { StudentTalentProfile } from "@/lib/talent-pathway/student-talent-profile";
import type { TalentAreaKey } from "@/lib/talent-pathway/talent-pathway-constants";

export type TalentFutureRecommendation = {
  type: "training" | "competition" | "enrichment" | "university_pathway";
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  priority: "high" | "medium" | "low";
  relatedTalentArea?: TalentAreaKey;
};

type RecommendationContext = {
  studentTalentProfile: StudentTalentProfile;
  trainingCount: number;
  competitionCount: number;
  targetMajors: string[];
  trainingOutcomeScore?: number;
};

const AREA_TRAINING: Record<TalentAreaKey, { ar: string; en: string }> = {
  technical: { ar: "تدريب تقني متقدم", en: "Advanced technical training" },
  research: { ar: "تدريب بحثي في مؤسسة أكاديمية", en: "Research training at an academic institution" },
  leadership: { ar: "تدريب قيادي في جهة حكومية", en: "Leadership training in a government partner" },
  health: { ar: "تدريب صحي ميداني", en: "Clinical health training" },
  engineering: { ar: "تدريب هندسي تطبيقي", en: "Applied engineering training" },
  entrepreneurial: { ar: "تدريب ريادة أعمال", en: "Entrepreneurship training" },
  creative: { ar: "تدريب إبداعي وإعلامي", en: "Creative & media training" },
};

const AREA_COMPETITION: Record<TalentAreaKey, { ar: string; en: string }> = {
  technical: { ar: "مسابقات البرمجة والروبوت", en: "Programming & robotics competitions" },
  research: { ar: "الأولمبيادات العلمية", en: "Science olympiads" },
  leadership: { ar: "مسابقات القيادة والخطابة", en: "Leadership & public speaking competitions" },
  health: { ar: "مسابقات العلوم الصحية", en: "Health science competitions" },
  engineering: { ar: "مسابقات الهندسة والابتكار", en: "Engineering innovation competitions" },
  entrepreneurial: { ar: "مسابقات ريادة الأعمال", en: "Entrepreneurship competitions" },
  creative: { ar: "مسابقات الفن والتصميم", en: "Art & design competitions" },
};

export const buildTalentFutureRecommendations = (
  context: RecommendationContext
): TalentFutureRecommendation[] => {
  const recs: TalentFutureRecommendation[] = [];
  const primary = context.studentTalentProfile.primaryTalentAreas[0];

  if (primary) {
    recs.push({
      type: "training",
      titleAr: AREA_TRAINING[primary.key].ar,
      titleEn: AREA_TRAINING[primary.key].en,
      reasonAr: `لأن مجال موهبتك الأساسي ${primary.labelAr} يتوافق مع هذا النوع من التدريب.`,
      reasonEn: `Because your primary talent area (${primary.labelEn}) aligns with this training type.`,
      priority: "high",
      relatedTalentArea: primary.key,
    });
    recs.push({
      type: "competition",
      titleAr: AREA_COMPETITION[primary.key].ar,
      titleEn: AREA_COMPETITION[primary.key].en,
      reasonAr: `لتعزيز مسار ${primary.labelAr} عبر المشاركة في مسابقات متخصصة.`,
      reasonEn: `To strengthen your ${primary.labelEn} pathway through specialized competitions.`,
      priority: context.competitionCount < 2 ? "high" : "medium",
      relatedTalentArea: primary.key,
    });
  }

  if (context.trainingCount === 0) {
    recs.push({
      type: "training",
      titleAr: "التدريب الصيفي المهني",
      titleEn: "Summer professional training",
      reasonAr: "لا يوجد تدريب مسجل — يُنصح بالتقديم على فرصة تدريب لتعزيز الجاهزية.",
      reasonEn: "No training on record — apply for a placement to strengthen readiness.",
      priority: "high",
    });
  }

  for (const major of context.targetMajors.slice(0, 2)) {
    recs.push({
      type: "university_pathway",
      titleAr: `مسار جامعي: ${major}`,
      titleEn: `University pathway: ${major}`,
      reasonAr: "مبني على تخصصاتك المستهدفة وملف موهبتك.",
      reasonEn: "Based on your target majors and talent profile.",
      priority: "medium",
    });
  }

  if ((context.trainingOutcomeScore ?? 0) >= 75) {
    recs.push({
      type: "enrichment",
      titleAr: "برامج إثراء متقدمة",
      titleEn: "Advanced enrichment programs",
      reasonAr: "نتائج تدريبك مرتفعة — أنت جاهز لبرامج إثراء أكثر تحدياً.",
      reasonEn: "Strong training outcomes — you are ready for more challenging enrichment.",
      priority: "medium",
    });
  } else {
    recs.push({
      type: "enrichment",
      titleAr: "برامج مهارات أساسية",
      titleEn: "Core skills enrichment programs",
      reasonAr: "برامج إثراء لبناء أساس أقوى قبل التخصص المتقدم.",
      reasonEn: "Enrichment programs to build a stronger foundation before advanced specialization.",
      priority: "low",
    });
  }

  return recs.slice(0, 10);
};
