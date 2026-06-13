import type { CareerRecommendation } from "@/lib/career/career-recommendations";

export type CareerInsightInput = {
  isAr: boolean;
  universityReadinessScore: number;
  careerReadinessScore: number;
  achievementsScore: number;
  leadershipScore: number;
  skillsScore: number;
  skills: string[];
  trainingHours: number;
  volunteerHours: number;
  medalCount: number;
  recommendations: CareerRecommendation[];
};

const topSkills = (skills: string[], n = 5) => skills.slice(0, n).join(", ") || "—";

export const generateCareerInsight = (input: CareerInsightInput): string => {
  const lang = input.isAr ? "ar" : "en";
  if (lang === "ar") {
    return [
      `مؤشر الجاهزية المهنية: ${input.careerReadinessScore}/100.`,
      input.trainingHours > 0
        ? `لديك ${input.trainingHours} ساعة تدريب مسجلة.`
        : "لم تُسجّل ساعات تدريب بعد — يُنصح بالانضمام لبرنامج التدريب الصيفي.",
      input.volunteerHours > 0
        ? `ساعات التطوع: ${input.volunteerHours}.`
        : "أضف ساعات تطوع لتعزيز ملفك.",
      input.medalCount > 0
        ? `لديك ${input.medalCount} ميدالية في الإنجازات.`
        : "المشاركة في المسابقات تعزز فرص القبول الجامعي.",
      `أبرز المهارات: ${topSkills(input.skills)}.`,
    ].join(" ");
  }
  return [
    `Career readiness index: ${input.careerReadinessScore}/100.`,
    input.trainingHours > 0
      ? `You have ${input.trainingHours} recorded training hours.`
      : "No training hours yet — consider the summer training program.",
    input.volunteerHours > 0
      ? `Volunteer hours: ${input.volunteerHours}.`
      : "Add volunteer hours to strengthen your profile.",
    input.medalCount > 0
      ? `You have ${input.medalCount} achievement medals.`
      : "Competition participation improves university readiness.",
    `Top skills: ${topSkills(input.skills)}.`,
  ].join(" ");
};

export const generateUniversityInsight = (input: CareerInsightInput): string => {
  const lang = input.isAr ? "ar" : "en";
  const level =
    input.universityReadinessScore >= 75
      ? lang === "ar"
        ? "جاهزية عالية"
        : "High readiness"
      : input.universityReadinessScore >= 50
        ? lang === "ar"
          ? "جاهزية متوسطة"
          : "Moderate readiness"
        : lang === "ar"
          ? "جاهزية نامية"
          : "Developing readiness";

  if (lang === "ar") {
    return [
      `${level} (${input.universityReadinessScore}/100).`,
      `درجة الإنجازات: ${input.achievementsScore}، القيادة: ${input.leadershipScore}، المهارات: ${input.skillsScore}.`,
      input.recommendations.length > 0
        ? `أول توصية: ${input.recommendations[0].titleAr}.`
        : "استمر في بناء ملفك الأكاديمي.",
    ].join(" ");
  }
  return [
    `${level} (${input.universityReadinessScore}/100).`,
    `Achievements: ${input.achievementsScore}, leadership: ${input.leadershipScore}, skills: ${input.skillsScore}.`,
    input.recommendations.length > 0
      ? `Top recommendation: ${input.recommendations[0].titleEn}.`
      : "Continue building your academic profile.",
  ].join(" ");
};

export const generateSkillGapAnalysis = (input: CareerInsightInput): string => {
  const coreSkills = ["Problem Solving", "Communication", "Leadership", "Research", "Teamwork"];
  const missing = coreSkills.filter(
    (s) => !input.skills.some((skill) => skill.toLowerCase().includes(s.toLowerCase()))
  );

  if (input.isAr) {
    if (missing.length === 0) {
      return "تغطي مهاراتك الأساسية مجالات متعددة. ركّز على التعمق في تخصصك المستهدف.";
    }
    return `فجوات مهارية محتملة: ${missing.join("، ")}. يُنصح بمبادرات أو دورات تطوّر هذه المهارات.`;
  }
  if (missing.length === 0) {
    return "Your profile covers core skill areas. Focus on depth in your target field.";
  }
  return `Potential skill gaps: ${missing.join(", ")}. Consider initiatives or courses to develop these areas.`;
};
