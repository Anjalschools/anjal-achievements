import type { StudentActionList } from "@/lib/school-improvement/school-improvement-types";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type { StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

export const buildStudentActionLists = (
  intelligence: SchoolIntelligencePayload,
  nodes: StudentSuccessGraphNode[]
): StudentActionList[] => {
  const interventionStudents = intelligence.interventions.slice(0, 25).map((row) => {
    const node = nodes.find((n) => n.studentId === row.studentId);
    return {
      studentId: row.studentId,
      fullName: row.fullName,
      grade: node?.grade || "",
      reasonAr: row.detailAr,
      reasonEn: row.detailEn,
      suggestedActionAr:
        row.interventionType === "participation_stop"
          ? "جلسة إرشاد + فرصة مشاركة فورية"
          : row.interventionType === "readiness_drop"
            ? "خطة دعم جاهزية"
            : "متابعة أسبوعية للنشاط",
      suggestedActionEn:
        row.interventionType === "participation_stop"
          ? "Counseling session + immediate participation slot"
          : row.interventionType === "readiness_drop"
            ? "Readiness support plan"
            : "Weekly activity follow-up",
    };
  });

  const trainingStudents = nodes
    .filter(
      (n) =>
        n.subScores.careerReadiness >= 45 &&
        n.trainingHours < 15 &&
        n.participationCount >= 1
    )
    .slice(0, 25)
    .map((n) => ({
      studentId: n.studentId,
      fullName: n.fullNameAr || n.fullNameEn,
      grade: n.grade,
      reasonAr: `جاهزية مهنية ${n.subScores.careerReadiness}/100 مع ساعات تدريب منخفضة (${n.trainingHours})`,
      reasonEn: `Career readiness ${n.subScores.careerReadiness}/100 with low training hours (${n.trainingHours})`,
      suggestedActionAr: "ترشيح لفرصة تدريب صيفي أو مهني",
      suggestedActionEn: "Nominate for summer or professional training",
    }));

  const giftedStudents = [
    ...intelligence.talentDiscovery.filter((t) => t.talentType === "program_candidate"),
    ...intelligence.talentDiscovery.filter((t) => t.talentType === "underutilized"),
  ]
    .slice(0, 25)
    .map((row) => {
      const node = nodes.find((n) => n.studentId === row.studentId);
      return {
        studentId: row.studentId,
        fullName: row.fullName,
        grade: node?.grade || "",
        reasonAr: row.detailAr,
        reasonEn: row.detailEn,
        suggestedActionAr:
          row.talentType === "underutilized"
            ? "إثراء موهبة + مسابقة متقدمة"
            : "برنامج موهبة نوعي",
        suggestedActionEn:
          row.talentType === "underutilized"
            ? "Talent enrichment + advanced competition"
            : "Special gifted program",
      };
    });

  const dedupe = (items: StudentActionList["students"]) => {
    const seen = new Set<string>();
    return items.filter((s) => {
      if (seen.has(s.studentId)) return false;
      seen.add(s.studentId);
      return true;
    });
  };

  return [
    {
      category: "intervention",
      titleAr: "طلاب يحتاجون تدخلاً",
      titleEn: "Students needing intervention",
      students: dedupe(interventionStudents),
    },
    {
      category: "training_opportunity",
      titleAr: "طلاب يحتاجون فرص تدريب",
      titleEn: "Students needing training opportunities",
      students: dedupe(trainingStudents),
    },
    {
      category: "gifted_program",
      titleAr: "طلاب يحتاجون برامج موهبة",
      titleEn: "Students needing gifted programs",
      students: dedupe(giftedStudents),
    },
  ];
};
