import type {
  DepartmentExcellenceRow,
  SchoolExcellenceSummary,
  StrategicSchoolInsight,
  StudentSuccessGraphNode,
} from "@/lib/school-intelligence/school-intelligence-types";
import { traceSchoolIntelligenceSectionSync } from "@/lib/school-intelligence/school-intelligence-section-tracer";

let insightCounter = 0;
const nextId = () => `school-insight-${++insightCounter}`;

export const buildStrategicSchoolInsights = (input: {
  nodes: StudentSuccessGraphNode[];
  departmentExcellence: DepartmentExcellenceRow[];
  schoolExcellence: SchoolExcellenceSummary;
}): StrategicSchoolInsight[] =>
  traceSchoolIntelligenceSectionSync("buildStrategicInsights", "strategic_insights", () => {
  insightCounter = 0;
  const insights: StrategicSchoolInsight[] = [];
  const { nodes, departmentExcellence, schoolExcellence } = input;

  const secondaryG10 = nodes.filter((n) => n.grade === "g10");
  const secondaryAll = nodes.filter((n) => n.stage === "secondary");
  if (secondaryG10.length > 0 && secondaryAll.length > 0) {
    const g10Avg = secondaryG10.reduce((s, n) => s + n.participationCount, 0) / secondaryG10.length;
    const secAvg = secondaryAll.reduce((s, n) => s + n.participationCount, 0) / secondaryAll.length;
    if (g10Avg < secAvg * 0.7) {
      insights.push({
        id: nextId(),
        titleAr: "أقل مشاركة في الصف الأول الثانوي",
        titleEn: "Lowest participation in Grade 10",
        bodyAr: `طلاب الصف الأول الثانوي لديهم معدل مشاركة ${g10Avg.toFixed(1)} مقارنةً بـ ${secAvg.toFixed(1)} للمرحلة الثانوية.`,
        bodyEn: `Grade 10 students average ${g10Avg.toFixed(1)} participations vs ${secAvg.toFixed(1)} for secondary.`,
        severity: "medium",
        insightType: "participation_gap",
        evidence: [
          { label: "g10AvgParticipation", value: Math.round(g10Avg * 10) / 10 },
          { label: "secondaryAvg", value: Math.round(secAvg * 10) / 10 },
        ],
      });
    }
  }

  const arabicTrack = departmentExcellence.find((r) => r.key === "arabic" && r.dimension === "track");
  const intlTrack = departmentExcellence.find((r) => r.key === "international" && r.dimension === "track");
  if (arabicTrack && intlTrack && arabicTrack.excellenceIndex > intlTrack.excellenceIndex + 8) {
    insights.push({
      id: nextId(),
      titleAr: "المسار العربي يتفوق في مؤشر التميز",
      titleEn: "Arabic track leads excellence index",
      bodyAr: `المسار العربي يحقق مؤشر ${arabicTrack.excellenceIndex} مقابل ${intlTrack.excellenceIndex} للمسار الدولي.`,
      bodyEn: `Arabic track excellence ${arabicTrack.excellenceIndex} vs international ${intlTrack.excellenceIndex}.`,
      severity: "info",
      insightType: "track_comparison",
      evidence: [
        { label: "arabicIndex", value: arabicTrack.excellenceIndex },
        { label: "internationalIndex", value: intlTrack.excellenceIndex },
      ],
    });
  }

  const mawhiba = departmentExcellence.find((r) => r.key === "mawhiba");
  const general = departmentExcellence.find((r) => r.key === "general");
  if (mawhiba && general && mawhiba.avgSuccessIndex > general.avgSuccessIndex + 5) {
    insights.push({
      id: nextId(),
      titleAr: "قسم الموهوبين يحقق أعلى مؤشر نجاح",
      titleEn: "Gifted department leads success index",
      bodyAr: `متوسط مؤشر النجاح في قسم الموهوبين ${mawhiba.avgSuccessIndex} مقابل ${general.avgSuccessIndex} في القسم العام.`,
      bodyEn: `Mawhiba avg success ${mawhiba.avgSuccessIndex} vs general ${general.avgSuccessIndex}.`,
      severity: "info",
      insightType: "department_comparison",
      evidence: [
        { label: "mawhibaSSI", value: mawhiba.avgSuccessIndex },
        { label: "generalSSI", value: general.avgSuccessIndex },
      ],
    });
  }

  const highTraining = nodes.filter((n) => n.trainingHours >= 20);
  const sciTrack = nodes.filter((n) => n.track === "arabic" && n.stage === "secondary");
  if (highTraining.length > 0 && sciTrack.length > 0) {
    const trainAvg = sciTrack.reduce((s, n) => s + n.trainingHours, 0) / sciTrack.length;
    const schoolTrainAvg = nodes.reduce((s, n) => s + n.trainingHours, 0) / nodes.length;
    if (trainAvg > schoolTrainAvg * 1.15) {
      insights.push({
        id: nextId(),
        titleAr: "أعلى عائد تدريب في المسار العربي الثانوي",
        titleEn: "Highest training ROI in Arabic secondary track",
        bodyAr: `متوسط ساعات التدريب ${trainAvg.toFixed(1)} في المسار العربي الثانوي مقابل ${schoolTrainAvg.toFixed(1)} على مستوى المدرسة.`,
        bodyEn: `Training hours ${trainAvg.toFixed(1)} in Arabic secondary vs school avg ${schoolTrainAvg.toFixed(1)}.`,
        severity: "medium",
        insightType: "training_roi",
        evidence: [
          { label: "trackTrainingAvg", value: Math.round(trainAvg * 10) / 10 },
          { label: "schoolTrainingAvg", value: Math.round(schoolTrainAvg * 10) / 10 },
        ],
      });
    }
  }

  if (schoolExcellence.participationRatePct < 50) {
    insights.push({
      id: nextId(),
      titleAr: "معدل مشاركة مدرسي منخفض",
      titleEn: "Low school-wide participation rate",
      bodyAr: `${schoolExcellence.participationRatePct}% فقط من الطلاب لديهم مشاركات مسجّلة.`,
      bodyEn: `Only ${schoolExcellence.participationRatePct}% of students have recorded participations.`,
      severity: "high",
      insightType: "school_participation",
      evidence: [
        { label: "participationRatePct", value: schoolExcellence.participationRatePct },
        { label: "activeParticipants", value: schoolExcellence.activeParticipants },
        { label: "totalStudents", value: schoolExcellence.totalStudents },
      ],
    });
  }

  const topDept = departmentExcellence[0];
  if (topDept) {
    insights.push({
      id: nextId(),
      titleAr: `أعلى تميز: ${topDept.labelAr}`,
      titleEn: `Top excellence: ${topDept.labelEn}`,
      bodyAr: `${topDept.labelAr} يحقق مؤشر تميز ${topDept.excellenceIndex}/100 مع ${topDept.studentCount} طالب.`,
      bodyEn: `${topDept.labelEn} scores ${topDept.excellenceIndex}/100 with ${topDept.studentCount} students.`,
      severity: "info",
      insightType: "top_cohort",
      evidence: [
        { label: "excellenceIndex", value: topDept.excellenceIndex },
        { label: "studentCount", value: topDept.studentCount },
      ],
    });
  }

  return insights.slice(0, 12);
});
