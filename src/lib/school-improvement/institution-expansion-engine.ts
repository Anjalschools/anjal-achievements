import type { InstitutionExpansionSuggestion } from "@/lib/school-improvement/school-improvement-types";
import type { StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

const TECH_SKILLS = ["programming", "coding", "robotics", "ai", "python", "برمجة", "روبوت", "ذكاء"];

export const buildInstitutionExpansion = (
  nodes: StudentSuccessGraphNode[]
): InstitutionExpansionSuggestion[] => {
  const suggestions: InstitutionExpansionSuggestion[] = [];

  const techStudents = nodes.filter((n) =>
    n.topSkills.some((s) => TECH_SKILLS.some((k) => s.toLowerCase().includes(k)))
  );
  const highTrainingLowHours = nodes.filter((n) => n.subScores.trainingScore < 50 && n.stage === "secondary");
  const highUniReadiness = nodes.filter((n) => n.subScores.universityReadiness >= 65);

  if (techStudents.length >= 5) {
    suggestions.push({
      id: "inst-tech-companies",
      sector: "technology",
      titleAr: "شركات تقنية وبرمجة",
      titleEn: "Technology and software companies",
      reasonAr: `${techStudents.length} طالب يظهرون مهارات تقنية — الحاجة لشراكات تدريب تقني`,
      reasonEn: `${techStudents.length} students show technical skills — need tech training partnerships`,
      studentSignal: "technical_skills_cluster",
      priority: techStudents.length >= 15 ? "high" : "medium",
      evidence: [{ label: "techStudentCount", value: techStudents.length }],
    });
  }

  if (highUniReadiness.length >= 10) {
    suggestions.push({
      id: "inst-universities",
      sector: "university",
      titleAr: "جامعات وبرامج أكاديمية",
      titleEn: "Universities and academic programs",
      reasonAr: `${highUniReadiness.length} طالب بجاهزية جامعية مرتفعة — فرصة لشراكات قبول ومعايشة`,
      reasonEn: `${highUniReadiness.length} students with high university readiness — admission and immersion partnerships`,
      studentSignal: "high_university_readiness",
      priority: "medium",
      evidence: [{ label: "highReadinessCount", value: highUniReadiness.length }],
    });
  }

  const leadershipStrong = nodes.filter((n) => n.subScores.skillScore >= 55 && n.volunteerHours >= 10);
  if (leadershipStrong.length >= 8) {
    suggestions.push({
      id: "inst-incubators",
      sector: "incubator",
      titleAr: "حاضنات أعمال وريادة",
      titleEn: "Business incubators and entrepreneurship",
      reasonAr: "تجمع طلابي بمهارات قيادية وتطوع — مناسب لبرامج ريادة",
      reasonEn: "Student cluster with leadership skills and volunteer hours — fit for entrepreneurship programs",
      studentSignal: "leadership_volunteer_cluster",
      priority: "medium",
      evidence: [{ label: "leadershipCluster", value: leadershipStrong.length }],
    });
  }

  if (highTrainingLowHours.length >= 20) {
    suggestions.push({
      id: "inst-engineering",
      sector: "engineering",
      titleAr: "مؤسسات هندسية وتطبيقية",
      titleEn: "Engineering and applied institutions",
      reasonAr: "شريحة ثانوية بساعات تدريب منخفضة — توسيع الشراكات الهندسية",
      reasonEn: "Secondary cohort with low training hours — expand engineering partnerships",
      studentSignal: "secondary_training_gap",
      priority: "high",
      evidence: [{ label: "secondaryLowTraining", value: highTrainingLowHours.length }],
    });
  }

  return suggestions;
};
