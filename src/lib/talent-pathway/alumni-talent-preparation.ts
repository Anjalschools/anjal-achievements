import type { StudentTalentProfile } from "@/lib/talent-pathway/student-talent-profile";
import type { TalentCareerReadinessIndex } from "@/lib/talent-pathway/talent-career-readiness-index";
import type { AlumniTalentPreparationPayload } from "@/lib/talent-pathway/talent-pathway-intelligence-types";

export const buildAlumniTalentPreparation = (
  studentTalentProfile: StudentTalentProfile,
  careerReadiness: TalentCareerReadinessIndex,
  targetMajors: string[]
): AlumniTalentPreparationPayload => {
  const primary = studentTalentProfile.primaryTalentAreas[0];

  const recommendedMentors = primary
    ? [
        {
          focusAreaAr: `مرشد في مجال ${primary.labelAr}`,
          focusAreaEn: `Mentor in ${primary.labelEn}`,
          reasonAr: `لأن موهبتك الأساسية ${primary.labelAr} تحتاج إرشاداً مهنياً متخصصاً.`,
          reasonEn: `Your primary talent (${primary.labelEn}) benefits from specialized mentorship.`,
        },
      ]
    : [
        {
          focusAreaAr: "مرشد أكاديمي عام",
          focusAreaEn: "General academic mentor",
          reasonAr: "لدعم مسارك قبل الانتقال إلى مجتمع الخريجين.",
          reasonEn: "To support your pathway before joining the alumni community.",
        },
      ];

  const careerPathways = studentTalentProfile.primaryTalentAreas.slice(0, 3).map((area) => ({
    titleAr: `مسار ${area.labelAr}`,
    titleEn: `${area.labelEn} pathway`,
    reasonAr: `مسار مهني مبني على نقاط قوتك في ${area.labelAr}.`,
    reasonEn: `Career pathway built on your ${area.labelEn} strengths.`,
  }));

  const universityPreparation = targetMajors.length
    ? targetMajors.slice(0, 3).map((major) => ({
        titleAr: `تحضير جامعي: ${major}`,
        titleEn: `University prep: ${major}`,
        reasonAr: "خطة تحضيرية قبل التقديم الجامعي.",
        reasonEn: "Pre-application preparation plan.",
      }))
    : [
        {
          titleAr: "استكشاف التخصصات الجامعية",
          titleEn: "Explore university majors",
          reasonAr: "حدد تخصصاتك المستهدفة لتفعيل تحضير أدق.",
          reasonEn: "Define target majors to unlock sharper preparation.",
        },
      ];

  return {
    generatedAt: new Date().toISOString(),
    recommendedMentors,
    careerPathways,
    universityPreparation,
    communityReadinessScore: careerReadiness.careerReadinessIndex,
  };
};
