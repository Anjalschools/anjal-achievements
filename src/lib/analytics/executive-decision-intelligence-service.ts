import "server-only";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import { buildExecutiveInsights } from "@/lib/analytics/ai/executive-intelligence/executive-insights-engine";
import type { ExecutiveInsight } from "@/lib/analytics/ai/executive-intelligence/executive-insight-types";
import { buildInstitutionalSnapshot } from "@/lib/analytics/institutional-snapshot-builder";
import { buildCareerAnalyticsDashboard } from "@/lib/career/career-analytics-service";
import { buildPartnershipAnalyticsSummary } from "@/lib/partnerships/institution-analytics-service";

export type TalentPipelineRow = {
  studentId: string;
  fullName: string;
  grade: string;
  universityReadiness: number;
  careerReadiness: number;
  trainingHours: number;
  volunteerHours: number;
  achievementsScore: number;
  annualGrowth?: number;
  evidence: string;
};

export type RiskRow = {
  studentId: string;
  fullName: string;
  riskType: "activity_decline" | "readiness_drop" | "participation_stop";
  severity: "high" | "medium" | "low";
  detailAr: string;
  detailEn: string;
  evidence: Array<{ label: string; value: string | number }>;
};

export type OpportunityGapRow = {
  dimension: "grade" | "section" | "stage" | "activity";
  key: string;
  labelAr: string;
  labelEn: string;
  participationCount: number;
  benchmarkCount: number;
  gapPct: number;
  recommendationAr: string;
  recommendationEn: string;
};

export type InstitutionEffectivenessRow = {
  organizationId: string;
  organizationName: string;
  studentCount: number;
  totalHours: number;
  avgStudentBenefitRating: number;
  avgSupervisorRating: number;
  completionRatePct: number;
  satisfactionPct: number;
};

export type CompetitionRoiRow = {
  activityKey: string;
  labelAr: string;
  labelEn: string;
  participations: number;
  medals: number;
  currentYear: number;
  previousYear: number;
  growthRatePct: number;
  roiScore: number;
  evidence: string;
};

export type PredictiveForecast = {
  metric: string;
  labelAr: string;
  labelEn: string;
  currentYearValue: number;
  predictedNextYear: number;
  method: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type StrategicRecommendation = {
  category: "partnership" | "competition" | "enrichment" | "training";
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  priority: "high" | "medium" | "low";
  evidence: Array<{ label: string; value: string | number }>;
};

export type ExecutiveDecisionIntelligencePayload = {
  generatedAt: string;
  talentPipeline: {
    byUniversityReadiness: TalentPipelineRow[];
    byCareerReadiness: TalentPipelineRow[];
    byTrainingHours: TalentPipelineRow[];
    byVolunteerHours: TalentPipelineRow[];
    byAnnualGrowth: TalentPipelineRow[];
  };
  risks: RiskRow[];
  opportunityGaps: OpportunityGapRow[];
  institutionEffectiveness: InstitutionEffectivenessRow[];
  competitionRoi: CompetitionRoiRow[];
  executiveInsights: ExecutiveInsight[];
  strategicRecommendations: StrategicRecommendation[];
  predictions: PredictiveForecast[];
  careerSummary: Awaited<ReturnType<typeof buildCareerAnalyticsDashboard>>;
  partnershipAnalytics: Awaited<ReturnType<typeof buildPartnershipAnalyticsSummary>>;
  governance: {
    readOnly: true;
    explainable: true;
    dataSources: string[];
  };
};

const COMPETITION_KEYS = ["bebras", "kangaroo", "ibdaa", "math_olympiad", "mawhiba", "super_speller"];

const linearPredict = (series: Array<{ year: number; value: number }>): PredictiveForecast | null => {
  if (series.length < 2) return null;
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const delta = last.value - prev.value;
  return {
    metric: "participations",
    labelAr: "المشاركات",
    labelEn: "Participations",
    currentYearValue: last.value,
    predictedNextYear: Math.max(0, Math.round(last.value + delta)),
    method: "linear_trend_last_two_years",
    confidence: sorted.length >= 3 ? "MEDIUM" : "LOW",
  };
};

export const buildExecutiveDecisionIntelligence = async (): Promise<ExecutiveDecisionIntelligencePayload> => {
  await connectDB();
  const [snapshot, careerSummary, profiles, users, trainingRecords, opportunities] = await Promise.all([
    buildInstitutionalSnapshot(),
    buildCareerAnalyticsDashboard(),
    StudentCareerProfile.find({})
      .select(
        "studentId universityReadinessScore careerReadinessScore trainingHours volunteerHours achievementsScore scoresComputedAt"
      )
      .limit(3000)
      .lean(),
    User.find({ role: "student" }).select("_id fullNameAr fullName fullNameEn grade section").limit(5000).lean(),
    TrainingCompletionRecord.find({})
      .select(
        "organizationId organizationName studentId status volunteerHours studentBenefitRating overallRecommendation attendanceCommitment professionalEthics"
      )
      .limit(5000)
      .lean(),
    TrainingOpportunity.find({ active: { $ne: false } }).select("targetGrades seats").lean(),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const insightBundle = buildExecutiveInsights(snapshot, { maxInsights: 40 });
  const partnershipAnalytics = careerSummary.partnershipAnalytics || (await buildPartnershipAnalyticsSummary());

  const toTalentRow = (profile: (typeof profiles)[0], evidence: string): TalentPipelineRow => {
    const user = userMap.get(String(profile.studentId));
    return {
      studentId: String(profile.studentId),
      fullName: String(user?.fullNameAr || user?.fullName || "").trim() || "—",
      grade: String(user?.grade || ""),
      universityReadiness: Number(profile.universityReadinessScore || 0),
      careerReadiness: Number(profile.careerReadinessScore || 0),
      trainingHours: Number(profile.trainingHours || 0),
      volunteerHours: Number(profile.volunteerHours || 0),
      achievementsScore: Number(profile.achievementsScore || 0),
      evidence,
    };
  };

  const sortDesc = (field: keyof (typeof profiles)[0]) =>
    [...profiles].sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0));

  const talentPipeline = {
    byUniversityReadiness: sortDesc("universityReadinessScore")
      .slice(0, 15)
      .map((p) => toTalentRow(p, `universityReadinessScore=${p.universityReadinessScore}`)),
    byCareerReadiness: sortDesc("careerReadinessScore")
      .slice(0, 15)
      .map((p) => toTalentRow(p, `careerReadinessScore=${p.careerReadinessScore}`)),
    byTrainingHours: sortDesc("trainingHours")
      .slice(0, 15)
      .map((p) => toTalentRow(p, `trainingHours=${p.trainingHours}`)),
    byVolunteerHours: sortDesc("volunteerHours")
      .slice(0, 15)
      .map((p) => toTalentRow(p, `volunteerHours=${p.volunteerHours}`)),
    byAnnualGrowth: snapshot.studentSamples
      ?.filter((s) => s.recentTrend === "accelerating" || s.recentTrend === "improving")
      .slice(0, 15)
      .map((s) => ({
        studentId: s.userId,
        fullName: s.displayName,
        grade: "",
        universityReadiness: Math.round(s.recentQuality),
        careerReadiness: Math.round(s.recentQuality * 0.9),
        trainingHours: 0,
        volunteerHours: 0,
        achievementsScore: s.peakQuality,
        annualGrowth: Math.round(s.recentQuality - s.peakQuality * 0.5),
        evidence: `trend=${s.recentTrend}, momentum=${s.momentum}`,
      })) || [],
  };

  const risks: RiskRow[] = [];
  for (const sample of snapshot.studentSamples?.filter((s) => s.recentTrend === "declining") || []) {
    risks.push({
      studentId: sample.userId,
      fullName: sample.displayName,
      riskType: "activity_decline",
      severity: "high",
      detailAr: `تراجع في النشاط — جودة حديثة ${Math.round(sample.recentQuality)}/100`,
      detailEn: `Activity decline — recent quality ${Math.round(sample.recentQuality)}/100`,
      evidence: [
        { label: "trend", value: sample.recentTrend },
        { label: "recentQuality", value: Math.round(sample.recentQuality) },
        { label: "peakQuality", value: sample.peakQuality },
      ],
    });
  }
  for (const p of profiles.filter((row) => Number(row.universityReadinessScore) < 35 && Number(row.achievementsScore) < 30)) {
    const user = userMap.get(String(p.studentId));
    risks.push({
      studentId: String(p.studentId),
      fullName: String(user?.fullNameAr || user?.fullName || "").trim() || "—",
      riskType: "readiness_drop",
      severity: "medium",
      detailAr: `جاهزية جامعية منخفضة (${p.universityReadinessScore}/100)`,
      detailEn: `Low university readiness (${p.universityReadinessScore}/100)`,
      evidence: [
        { label: "universityReadiness", value: Number(p.universityReadinessScore || 0) },
        { label: "achievementsScore", value: Number(p.achievementsScore || 0) },
      ],
    });
  }

  const avgParticipation =
    snapshot.stageBreakdown.reduce((s, row) => s + row.totalParticipations, 0) /
    Math.max(snapshot.stageBreakdown.length, 1);

  const opportunityGaps: OpportunityGapRow[] = snapshot.stageBreakdown
    .filter((s) => s.totalParticipations < avgParticipation * 0.6)
    .map((s) => ({
      dimension: "stage" as const,
      key: `${s.stage}-${s.section}`,
      labelAr: `${s.stage} (${s.section})`,
      labelEn: `${s.stage} (${s.section})`,
      participationCount: s.totalParticipations,
      benchmarkCount: Math.round(avgParticipation),
      gapPct: Math.round((1 - s.totalParticipations / Math.max(avgParticipation, 1)) * 100),
      recommendationAr: "توسيع فرص المسابقات والتدريب لهذه الشريحة",
      recommendationEn: "Expand competition and training opportunities for this segment",
    }));

  for (const act of snapshot.activityBreakdown.filter((a) => a.currentYear < 5 && a.previousYear >= 10)) {
    opportunityGaps.push({
      dimension: "activity",
      key: act.activityKey,
      labelAr: act.activityLabelAr,
      labelEn: act.activityKey,
      participationCount: act.currentYear,
      benchmarkCount: act.previousYear,
      gapPct: Math.round((1 - act.currentYear / Math.max(act.previousYear, 1)) * 100),
      recommendationAr: `إعادة تفعيل مشاركة ${act.activityLabelAr}`,
      recommendationEn: `Re-engage participation in ${act.activityKey}`,
    });
  }

  const orgIds = [...new Set(trainingRecords.map((r) => String(r.organizationId)))];
  const orgs = await PartnerOrganization.find({ _id: { $in: orgIds } }).lean();
  const orgNameMap = new Map(orgs.map((o) => [String(o._id), o.name]));

  const institutionEffectiveness: InstitutionEffectivenessRow[] = orgIds.map((orgId) => {
    const rows = trainingRecords.filter((r) => String(r.organizationId) === orgId);
    const students = new Set(rows.map((r) => String(r.studentId)));
    const approved = rows.filter((r) => r.status === "approved");
    const ratings = rows
      .map((r) => Number(r.studentBenefitRating || r.overallRecommendation || 0))
      .filter((v) => v > 0);
    const supervisorRatings = rows
      .map((r) => {
        const vals = [r.attendanceCommitment, r.professionalEthics, r.overallRecommendation].filter(
          (v): v is number => typeof v === "number" && v > 0
        );
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      })
      .filter((v) => v > 0);
    const hours = rows.reduce((s, r) => s + Number(r.volunteerHours || 0), 0);
    const avgBenefit = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
    const avgSupervisor =
      supervisorRatings.length
        ? Math.round((supervisorRatings.reduce((a, b) => a + b, 0) / supervisorRatings.length) * 10) / 10
        : 0;
    const completionRate = rows.length > 0 ? Math.round((approved.length / rows.length) * 100) : 0;
    return {
      organizationId: orgId,
      organizationName: orgNameMap.get(orgId) || rows[0]?.organizationName || orgId,
      studentCount: students.size,
      totalHours: hours,
      avgStudentBenefitRating: avgBenefit,
      avgSupervisorRating: avgSupervisor,
      completionRatePct: completionRate,
      satisfactionPct: avgBenefit > 0 ? Math.round((avgBenefit / 5) * 100) : 0,
    };
  }).sort((a, b) => b.satisfactionPct - a.satisfactionPct);

  const competitionRoi: CompetitionRoiRow[] = snapshot.activityBreakdown
    .filter((a) => COMPETITION_KEYS.some((k) => a.activityKey.includes(k)) || a.domain === "competition" || a.domain === "olympiad")
    .slice(0, 20)
    .map((a) => {
      const medalEstimate = Math.round(a.awardCount * 0.6);
      const roiScore = Math.round(a.currentYear * 2 + medalEstimate * 5 + Math.max(a.growthRatePct, 0) * 0.3);
      return {
        activityKey: a.activityKey,
        labelAr: a.activityLabelAr,
        labelEn: a.activityKey,
        participations: a.participations,
        medals: medalEstimate,
        currentYear: a.currentYear,
        previousYear: a.previousYear,
        growthRatePct: a.growthRatePct,
        roiScore,
        evidence: `participations=${a.participations}, awards=${a.awardCount}, growth=${a.growthRatePct}%`,
      };
    });

  const ruleInsights: ExecutiveInsight[] = [];
  if (careerSummary.averages.universityReadiness >= careerSummary.averages.careerReadiness) {
    ruleInsights.push({
      id: `rule-uni-readiness-${Date.now()}`,
      insightType: "benchmark",
      severity: "info",
      title: "الجاهزية الجامعية أعلى من المهنية في المتوسط",
      titleEn: "University readiness exceeds career readiness on average",
      body: `متوسط الجاهزية الجامعية ${careerSummary.averages.universityReadiness} مقابل مهنية ${careerSummary.averages.careerReadiness}.`,
      evidence: [
        { label: "universityReadiness", value: careerSummary.averages.universityReadiness },
        { label: "careerReadiness", value: careerSummary.averages.careerReadiness },
      ],
      recommendation: "تعزيز برامج التدريب الصيفي لرفع الجاهزية المهنية.",
      recommendationEn: "Strengthen summer training to lift career readiness.",
      affectedEntity: "school",
      affectedEntityType: "school",
      domain: "career",
      confidence: "HIGH",
      generatedAt: new Date().toISOString(),
      metadata: { rule: "uni_vs_career_avg" },
    });
  }

  const topOrg = institutionEffectiveness[0];
  if (topOrg && topOrg.satisfactionPct > 0) {
    ruleInsights.push({
      id: `rule-top-org-${Date.now()}`,
      insightType: "benchmark",
      severity: "info",
      title: `مؤسسة ${topOrg.organizationName} تحقق أفضل معدل رضا`,
      titleEn: `${topOrg.organizationName} achieves highest satisfaction`,
      body: `معدل رضا الطلاب ${topOrg.satisfactionPct}% مع ${topOrg.studentCount} متدرب.`,
      evidence: [
        { label: "satisfactionPct", value: topOrg.satisfactionPct },
        { label: "studentCount", value: topOrg.studentCount },
      ],
      recommendation: "توسيع الشراكة مع هذه المؤسسة.",
      recommendationEn: "Expand partnership with this organization.",
      affectedEntity: topOrg.organizationId,
      affectedEntityType: "cohort",
      domain: "training",
      confidence: "HIGH",
      generatedAt: new Date().toISOString(),
      metadata: { rule: "top_institution_satisfaction" },
    });
  }

  const weakStage = snapshot.stageBreakdown.find((s) => s.participationRatePct < 20);
  if (weakStage) {
    ruleInsights.push({
      id: `rule-weak-stage-${Date.now()}`,
      insightType: "decline",
      severity: "high",
      title: `انخفاض مشاركة ${weakStage.stage}`,
      titleEn: `Low participation in ${weakStage.stage} stage`,
      body: `نسبة المشاركة ${weakStage.participationRatePct}% في ${weakStage.stage}.`,
      evidence: [{ label: "participationRatePct", value: weakStage.participationRatePct }],
      recommendation: "برامج إثرائية موجهة لهذه المرحلة.",
      recommendationEn: "Targeted enrichment programs for this stage.",
      affectedEntity: weakStage.stage,
      affectedEntityType: "stage",
      domain: "participation",
      confidence: "MEDIUM",
      generatedAt: new Date().toISOString(),
      metadata: { rule: "weak_stage_participation" },
    });
  }

  const executiveInsights = [...insightBundle.insights, ...ruleInsights].slice(0, 50);

  const strategicRecommendations: StrategicRecommendation[] = [];
  if (opportunityGaps.length > 0) {
    strategicRecommendations.push({
      category: "competition",
      titleAr: "توسيع المسابقات في الشرائح ضعيفة المشاركة",
      titleEn: "Expand competitions in low-participation segments",
      reasonAr: `${opportunityGaps.length} شريحة تحتاج فرصاً إضافية`,
      reasonEn: `${opportunityGaps.length} segments need more opportunities`,
      priority: "high",
      evidence: opportunityGaps.slice(0, 3).map((g) => ({ label: g.key, value: g.gapPct })),
    });
  }
  if (institutionEffectiveness.length < 5) {
    strategicRecommendations.push({
      category: "partnership",
      titleAr: "شراكات تدريبية جديدة",
      titleEn: "New training partnerships",
      reasonAr: "عدد المؤسسات الفعالة محدود",
      reasonEn: "Limited active training organizations",
      priority: "medium",
      evidence: [{ label: "activeOrgs", value: institutionEffectiveness.length }],
    });
  }
  strategicRecommendations.push({
    category: "enrichment",
    titleAr: "برامج إثرائية للموهوبين",
    titleEn: "Gifted enrichment programs",
    reasonAr: `${talentPipeline.byUniversityReadiness.length} طالب بجاهزية عالية`,
    reasonEn: `${talentPipeline.byUniversityReadiness.length} students with high readiness`,
    priority: "medium",
    evidence: [{ label: "highReadinessPool", value: talentPipeline.byUniversityReadiness.length }],
  });
  if (opportunities.length > 0) {
    strategicRecommendations.push({
      category: "training",
      titleAr: "زيادة مقاعد التدريب الصيفي",
      titleEn: "Increase summer training seats",
      reasonAr: `${opportunities.length} فرصة نشطة — ${opportunities.reduce((s, o) => s + Number(o.seats || 0), 0)} مقعد`,
      reasonEn: `${opportunities.length} active opportunities`,
      priority: "low",
      evidence: [{ label: "totalSeats", value: opportunities.reduce((s, o) => s + Number(o.seats || 0), 0) }],
    });
  }

  const participationSeries = snapshot.yearOverYear.map((y) => ({ year: y.year, value: y.totalParticipations }));
  const predictions: PredictiveForecast[] = [];
  const partPred = linearPredict(participationSeries);
  if (partPred) predictions.push(partPred);
  predictions.push({
    metric: "training_completions",
    labelAr: "إكمالات التدريب",
    labelEn: "Training completions",
    currentYearValue: trainingRecords.filter((r) => r.status === "approved").length,
    predictedNextYear: Math.round(trainingRecords.filter((r) => r.status === "approved").length * 1.1),
    method: "ten_percent_growth_assumption",
    confidence: "LOW",
  });
  predictions.push({
    metric: "career_profiles",
    labelAr: "الملفات المهنية",
    labelEn: "Career profiles",
    currentYearValue: profiles.length,
    predictedNextYear: Math.round(profiles.length * 1.15),
    method: "adoption_growth_assumption",
    confidence: "LOW",
  });

  return {
    generatedAt: new Date().toISOString(),
    talentPipeline,
    risks: risks.slice(0, 30),
    opportunityGaps: opportunityGaps.slice(0, 20),
    institutionEffectiveness: institutionEffectiveness.slice(0, 20),
    competitionRoi,
    executiveInsights,
    strategicRecommendations,
    predictions,
    careerSummary,
    partnershipAnalytics,
    governance: {
      readOnly: true,
      explainable: true,
      dataSources: [
        "Achievement (approved)",
        "StudentCareerProfile",
        "TrainingCompletionRecord",
        "PartnerOrganization",
        "TrainingOpportunity",
        "InstitutionReview (student_feedback)",
        "User (students)",
      ],
    },
  };
};
