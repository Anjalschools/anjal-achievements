import type {
  DepartmentExcellenceRow,
  LongitudinalGrowthPoint,
  OpportunityMappingRow,
  SchoolExcellenceSummary,
  StrategicInsightCategory,
  StrategicSchoolInsight,
  StudentSuccessGraphNode,
  TalentDiscoveryRow,
} from "@/lib/school-intelligence/school-intelligence-types";
import { confidenceFromEvidenceCount } from "@/lib/school-intelligence/school-intelligence-confidence";
import { traceSchoolIntelligenceSectionSync } from "@/lib/school-intelligence/school-intelligence-section-tracer";

let insightCounter = 0;
const nextId = () => `school-insight-${++insightCounter}`;

const pushInsight = (input: {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  severity: StrategicSchoolInsight["severity"];
  insightType: string;
  category: StrategicInsightCategory;
  evidence: StrategicSchoolInsight["evidence"];
  sampleSize?: number;
}): StrategicSchoolInsight => ({
  id: nextId(),
  titleAr: input.titleAr,
  titleEn: input.titleEn,
  bodyAr: input.bodyAr,
  bodyEn: input.bodyEn,
  descriptionAr: input.bodyAr,
  descriptionEn: input.bodyEn,
  severity: input.severity,
  insightType: input.insightType,
  category: input.category,
  confidence: confidenceFromEvidenceCount(input.evidence.length, input.sampleSize ?? 20, 70),
  evidence: input.evidence,
});

export const buildStrategicSchoolInsights = (input: {
  nodes: StudentSuccessGraphNode[];
  departmentExcellence: DepartmentExcellenceRow[];
  schoolExcellence: SchoolExcellenceSummary;
  longitudinalGrowth?: LongitudinalGrowthPoint[];
  opportunityMapping?: OpportunityMappingRow[];
  talentDiscovery?: TalentDiscoveryRow[];
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
      insights.push(
        pushInsight({
          titleAr: "أقل مشاركة في الصف الأول الثانوي",
          titleEn: "Lowest participation in Grade 10",
          bodyAr: `طلاب الصف الأول الثانوي لديهم معدل مشاركة ${g10Avg.toFixed(1)} مقارنةً بـ ${secAvg.toFixed(1)} للمرحلة الثانوية.`,
          bodyEn: `Grade 10 students average ${g10Avg.toFixed(1)} participations vs ${secAvg.toFixed(1)} for secondary.`,
          severity: "medium",
          insightType: "participation_gap",
          category: "warning",
          evidence: [
            { label: "g10AvgParticipation", value: Math.round(g10Avg * 10) / 10 },
            { label: "secondaryAvg", value: Math.round(secAvg * 10) / 10 },
          ],
          sampleSize: secondaryG10.length,
        })
      );
    }
  }

  if (schoolExcellence.participationRatePct < 50) {
    insights.push(
      pushInsight({
        titleAr: "معدل مشاركة مدرسي منخفض",
        titleEn: "Low school-wide participation rate",
        bodyAr: `${schoolExcellence.participationRatePct}% فقط من الطلاب لديهم مشاركات مسجّلة.`,
        bodyEn: `Only ${schoolExcellence.participationRatePct}% of students have recorded participations.`,
        severity: "high",
        insightType: "school_participation",
        category: "warning",
        evidence: [
          { label: "participationRatePct", value: schoolExcellence.participationRatePct },
          { label: "activeParticipants", value: schoolExcellence.activeParticipants },
          { label: "totalStudents", value: schoolExcellence.totalStudents },
        ],
        sampleSize: schoolExcellence.totalStudents,
      })
    );
  } else if (schoolExcellence.participationRatePct >= 50) {
    insights.push(
      pushInsight({
        titleAr: "مشاركة مدرسية صحية",
        titleEn: "Healthy school participation",
        bodyAr: `${schoolExcellence.participationRatePct}% من الطلاب نشطون في الأنشطة.`,
        bodyEn: `${schoolExcellence.participationRatePct}% of students are active in activities.`,
        severity: "info",
        insightType: "participation_success",
        category: "success",
        evidence: [{ label: "participationRatePct", value: schoolExcellence.participationRatePct }],
        sampleSize: schoolExcellence.totalStudents,
      })
    );
  }

  const growthPoints = input.longitudinalGrowth ?? [];
  if (growthPoints.length >= 2) {
    const first = growthPoints[0];
    const last = growthPoints[growthPoints.length - 1];
    const changePct =
      first.participations > 0
        ? Math.round(((last.participations - first.participations) / first.participations) * 1000) / 10
        : 0;
    insights.push(
      pushInsight({
        titleAr: "اتجاه نمو المشاركات",
        titleEn: "Participation growth trend",
        bodyAr: `المشاركات ${first.participations} → ${last.participations} (${changePct >= 0 ? "+" : ""}${changePct}%).`,
        bodyEn: `Participations ${first.participations} → ${last.participations} (${changePct >= 0 ? "+" : ""}${changePct}%).`,
        severity: changePct >= 0 ? "info" : "medium",
        insightType: "growth_trend",
        category: "trend",
        evidence: [
          { label: "fromParticipations", value: first.participations },
          { label: "toParticipations", value: last.participations },
          { label: "changePct", value: changePct },
        ],
        sampleSize: growthPoints.length,
      })
    );
  }

  const arabicTrack = departmentExcellence.find((r) => r.key === "arabic" && r.dimension === "track");
  const intlTrack = departmentExcellence.find((r) => r.key === "international" && r.dimension === "track");
  if (arabicTrack && intlTrack && arabicTrack.excellenceIndex > intlTrack.excellenceIndex + 8) {
    insights.push(
      pushInsight({
        titleAr: "المسار العربي يتفوق في مؤشر التميز",
        titleEn: "Arabic track leads excellence index",
        bodyAr: `المسار العربي يحقق مؤشر ${arabicTrack.excellenceIndex} مقابل ${intlTrack.excellenceIndex} للمسار الدولي.`,
        bodyEn: `Arabic track excellence ${arabicTrack.excellenceIndex} vs international ${intlTrack.excellenceIndex}.`,
        severity: "info",
        insightType: "track_comparison",
        category: "success",
        evidence: [
          { label: "arabicIndex", value: arabicTrack.excellenceIndex },
          { label: "internationalIndex", value: intlTrack.excellenceIndex },
        ],
        sampleSize: arabicTrack.studentCount + intlTrack.studentCount,
      })
    );
  }

  const mawhiba = departmentExcellence.find((r) => r.key === "mawhiba");
  const general = departmentExcellence.find((r) => r.key === "general");
  if (mawhiba && general && mawhiba.avgSuccessIndex > general.avgSuccessIndex + 5) {
    insights.push(
      pushInsight({
        titleAr: "قسم الموهوبين يحقق أعلى مؤشر نجاح",
        titleEn: "Gifted department leads success index",
        bodyAr: `متوسط مؤشر النجاح في قسم الموهوبين ${mawhiba.avgSuccessIndex} مقابل ${general.avgSuccessIndex} في القسم العام.`,
        bodyEn: `Mawhiba avg success ${mawhiba.avgSuccessIndex} vs general ${general.avgSuccessIndex}.`,
        severity: "info",
        insightType: "department_comparison",
        category: "success",
        evidence: [
          { label: "mawhibaSSI", value: mawhiba.avgSuccessIndex },
          { label: "generalSSI", value: general.avgSuccessIndex },
        ],
        sampleSize: mawhiba.studentCount,
      })
    );
  }

  const fastestDept = [...departmentExcellence].sort((a, b) => b.growthRatePct - a.growthRatePct)[0];
  if (fastestDept && fastestDept.growthRatePct > 0) {
    insights.push(
      pushInsight({
        titleAr: `أسرع نمو: ${fastestDept.labelAr}`,
        titleEn: `Fastest growth: ${fastestDept.labelEn}`,
        bodyAr: `نمو ${fastestDept.growthRatePct}% في ${fastestDept.labelAr}.`,
        bodyEn: `${fastestDept.growthRatePct}% growth in ${fastestDept.labelEn}.`,
        severity: "info",
        insightType: "department_growth",
        category: "trend",
        evidence: [
          { label: "growthRatePct", value: fastestDept.growthRatePct },
          { label: "excellenceIndex", value: fastestDept.excellenceIndex },
        ],
        sampleSize: fastestDept.studentCount,
      })
    );
  }

  const topGap = (input.opportunityMapping ?? [])[0];
  if (topGap) {
    insights.push(
      pushInsight({
        titleAr: `فرصة توسع: ${topGap.labelAr}`,
        titleEn: `Expansion opportunity: ${topGap.labelEn}`,
        bodyAr: `فجوة مشاركة ${topGap.gapPct}% — ${topGap.recommendationAr}`,
        bodyEn: `${topGap.gapPct}% participation gap — ${topGap.recommendationEn}`,
        severity: topGap.gapPct >= 30 ? "high" : "medium",
        insightType: "opportunity_gap",
        category: "opportunity",
        evidence: [
          { label: "gapPct", value: topGap.gapPct },
          { label: "participantCount", value: topGap.participantCount },
        ],
        sampleSize: topGap.participantCount,
      })
    );
  }

  const sciTrack = nodes.filter((n) => n.track === "arabic" && n.stage === "secondary");
  if (sciTrack.length > 0) {
    const trainAvg = sciTrack.reduce((s, n) => s + n.trainingHours, 0) / sciTrack.length;
    const schoolTrainAvg = nodes.reduce((s, n) => s + n.trainingHours, 0) / nodes.length;
    if (trainAvg > schoolTrainAvg * 1.15) {
      insights.push(
        pushInsight({
          titleAr: "أعلى عائد تدريب في المسار العربي الثانوي",
          titleEn: "Highest training ROI in Arabic secondary track",
          bodyAr: `متوسط ساعات التدريب ${trainAvg.toFixed(1)} مقابل ${schoolTrainAvg.toFixed(1)} على مستوى المدرسة.`,
          bodyEn: `Training hours ${trainAvg.toFixed(1)} vs school avg ${schoolTrainAvg.toFixed(1)}.`,
          severity: "medium",
          insightType: "training_roi",
          category: "success",
          evidence: [
            { label: "trackTrainingAvg", value: Math.round(trainAvg * 10) / 10 },
            { label: "schoolTrainingAvg", value: Math.round(schoolTrainAvg * 10) / 10 },
          ],
          sampleSize: sciTrack.length,
        })
      );
    }
  }

  const competitionDecline = (input.opportunityMapping ?? []).find((row) => row.dimension === "activity");
  if (competitionDecline) {
    insights.push(
      pushInsight({
        titleAr: "تراجع في نشاط/مسابقة",
        titleEn: "Competition activity decline",
        bodyAr: `${competitionDecline.labelAr}: فجوة ${competitionDecline.gapPct}%.`,
        bodyEn: `${competitionDecline.labelEn}: ${competitionDecline.gapPct}% gap.`,
        severity: "medium",
        insightType: "competition_decline",
        category: "warning",
        evidence: [{ label: "gapPct", value: competitionDecline.gapPct }],
        sampleSize: competitionDecline.participantCount,
      })
    );
  }

  const readinessLeaders = nodes.filter((n) => n.subScores.universityReadiness >= 60);
  if (readinessLeaders.length >= 3) {
    const avgReadiness =
      readinessLeaders.reduce((s, n) => s + n.subScores.universityReadiness, 0) / readinessLeaders.length;
    insights.push(
      pushInsight({
        titleAr: "جاهزية جامعية قوية لمجموعة مختارة",
        titleEn: "Strong university readiness cohort",
        bodyAr: `${readinessLeaders.length} طالب(اً) بمتوسط جاهزية ${avgReadiness.toFixed(0)}%.`,
        bodyEn: `${readinessLeaders.length} students with avg readiness ${avgReadiness.toFixed(0)}%.`,
        severity: "info",
        insightType: "university_readiness",
        category: "success",
        evidence: [
          { label: "cohortSize", value: readinessLeaders.length },
          { label: "avgReadiness", value: Math.round(avgReadiness) },
        ],
        sampleSize: readinessLeaders.length,
      })
    );
  }

  const talentCount = input.talentDiscovery?.length ?? 0;
  if (talentCount > 0) {
    insights.push(
      pushInsight({
        titleAr: "إشارات مواهب قابلة للتوجيه",
        titleEn: "Actionable talent signals detected",
        bodyAr: `${talentCount} مرشح(اً) للمواهب/البرامج النوعية.`,
        bodyEn: `${talentCount} talent/program candidate(s) identified.`,
        severity: "info",
        insightType: "talent_signals",
        category: "opportunity",
        evidence: [{ label: "talentCandidates", value: talentCount }],
        sampleSize: talentCount,
      })
    );
  }

  const topDept = departmentExcellence[0];
  if (topDept) {
    insights.push(
      pushInsight({
        titleAr: `أعلى تميز: ${topDept.labelAr}`,
        titleEn: `Top excellence: ${topDept.labelEn}`,
        bodyAr: `${topDept.labelAr} يحقق مؤشر تميز ${topDept.excellenceIndex}/100.`,
        bodyEn: `${topDept.labelEn} scores ${topDept.excellenceIndex}/100 excellence.`,
        severity: "info",
        insightType: "top_cohort",
        category: "success",
        evidence: [
          { label: "excellenceIndex", value: topDept.excellenceIndex },
          { label: "studentCount", value: topDept.studentCount },
        ],
        sampleSize: topDept.studentCount,
      })
    );
  }

  return insights.slice(0, 10);
});
