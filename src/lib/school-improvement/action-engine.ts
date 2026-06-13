import type {
  ImprovementAction,
  ImprovementDomain,
} from "@/lib/school-improvement/school-improvement-types";
import type {
  OpportunityMappingRow,
  SchoolIntelligencePayload,
  StrategicSchoolInsight,
} from "@/lib/school-intelligence/school-intelligence-types";

const OWNER_LABELS = {
  school_admin: { ar: "إدارة المدرسة", en: "School administration" },
  department_head: { ar: "رئيس القسم", en: "Department head" },
  counselor: { ar: "المرشد الطلابي", en: "Student counselor" },
  partnerships: { ar: "منسق الشراكات", en: "Partnerships coordinator" },
  activities_coordinator: { ar: "منسق الأنشطة", en: "Activities coordinator" },
  career_guidance: { ar: "التوجيه المهني", en: "Career guidance" },
} as const;

const stableId = (parts: string[]) => parts.join(":").replace(/\s+/g, "_").slice(0, 120);

const fromInsight = (
  insight: StrategicSchoolInsight,
  input: {
    recommendationAr: string;
    recommendationEn: string;
    domain: ImprovementDomain | string;
    owner: ImprovementAction["owner"];
    effort: ImprovementAction["effort"];
    timeline: string;
    timelineEn: string;
    impactAr: string;
    impactEn: string;
    priority?: ImprovementAction["priority"];
  }
): ImprovementAction => {
  const ownerLabels = OWNER_LABELS[input.owner];
  return {
    id: stableId(["action", insight.id, input.domain]),
    sourceInsightId: insight.id,
    titleAr: insight.titleAr,
    titleEn: insight.titleEn,
    recommendationAr: input.recommendationAr,
    recommendationEn: input.recommendationEn,
    priority: input.priority || (insight.severity === "high" ? "high" : insight.severity === "medium" ? "medium" : "low"),
    expectedImpactAr: input.impactAr,
    expectedImpactEn: input.impactEn,
    effort: input.effort,
    owner: input.owner,
    ownerLabelAr: ownerLabels.ar,
    ownerLabelEn: ownerLabels.en,
    timeline: input.timeline,
    timelineEn: input.timelineEn,
    domain: input.domain,
    evidence: insight.evidence,
    trackingStatus: "proposed",
  };
};

const fromOpportunityGap = (gap: OpportunityMappingRow): ImprovementAction => ({
  id: stableId(["action", gap.key, "gap"]),
  sourceInsightId: gap.key,
  titleAr: `فجوة فرص: ${gap.labelAr}`,
  titleEn: `Opportunity gap: ${gap.labelEn}`,
  recommendationAr: gap.recommendationAr,
  recommendationEn: gap.recommendationEn,
  priority: gap.gapPct >= 40 ? "high" : gap.gapPct >= 20 ? "medium" : "low",
  expectedImpactAr: `رفع المشاركة بنسبة تقديرية ${Math.min(gap.gapPct, 30)}%`,
  expectedImpactEn: `Estimated participation uplift up to ${Math.min(gap.gapPct, 30)}%`,
  effort: gap.dimension === "institution" ? "high" : "medium",
  owner: gap.dimension === "institution" ? "partnerships" : "activities_coordinator",
  ownerLabelAr: gap.dimension === "institution" ? OWNER_LABELS.partnerships.ar : OWNER_LABELS.activities_coordinator.ar,
  ownerLabelEn: gap.dimension === "institution" ? OWNER_LABELS.partnerships.en : OWNER_LABELS.activities_coordinator.en,
  timeline: "90 يوماً",
  timelineEn: "90 days",
  domain: gap.dimension === "activity" ? "competitions" : "training",
  evidence: [
    { label: "gapPct", value: gap.gapPct },
    { label: "participantCount", value: gap.participantCount },
    { label: "opportunityCount", value: gap.opportunityCount },
  ],
  trackingStatus: "proposed",
});

export const buildActionEngine = (intelligence: SchoolIntelligencePayload): ImprovementAction[] => {
  const actions: ImprovementAction[] = [];

  for (const insight of intelligence.strategicInsights) {
    if (insight.insightType === "participation_gap" || insight.titleAr.includes("الصف الأول الثانوي")) {
      actions.push(
        fromInsight(insight, {
          recommendationAr: "إطلاق برنامج إثرائي مستهدف للصف الأول الثانوي مع متابعة أسبوعية للمشاركة",
          recommendationEn: "Launch a targeted enrichment program for Grade 10 with weekly participation follow-up",
          domain: "competitions",
          owner: "activities_coordinator",
          effort: "medium",
          timeline: "60 يوماً",
          timelineEn: "60 days",
          impactAr: "زيادة مشاركة الصف الأول الثانوي خلال الفصل الحالي",
          impactEn: "Increase Grade 10 participation within the current term",
          priority: "high",
        })
      );
    } else if (insight.insightType === "training_roi") {
      actions.push(
        fromInsight(insight, {
          recommendationAr: "توسيع مقاعد التدريب الصيفي للمسار العربي الثانوي",
          recommendationEn: "Expand summer training seats for Arabic secondary track",
          domain: "training",
          owner: "partnerships",
          effort: "high",
          timeline: "قبل الصيف",
          timelineEn: "Before summer",
          impactAr: "رفع ساعات التدريب وتحسين الجاهزية المهنية",
          impactEn: "Raise training hours and career readiness",
        })
      );
    } else if (insight.insightType === "school_participation") {
      actions.push(
        fromInsight(insight, {
          recommendationAr: "حملة مدرسية لإعادة تفعيل المشاركة لدى الطلاب غير النشطين",
          recommendationEn: "School-wide campaign to re-engage inactive students",
          domain: "competitions",
          owner: "school_admin",
          effort: "medium",
          timeline: "45 يوماً",
          timelineEn: "45 days",
          impactAr: "رفع معدل المشاركة المدرسية",
          impactEn: "Raise school-wide participation rate",
          priority: "high",
        })
      );
    } else if (insight.insightType === "department_comparison" && insight.titleAr.includes("الموهوبين")) {
      actions.push(
        fromInsight(insight, {
          recommendationAr: "نقل ممارسات قسم الموهوبين إلى الشريحة العامة عبر إرشاد موجه",
          recommendationEn: "Transfer gifted-department practices to general cohort via guided mentoring",
          domain: "talent",
          owner: "department_head",
          effort: "medium",
          timeline: "فصل دراسي",
          timelineEn: "One term",
          impactAr: "تقريب فجوة مؤشر النجاح بين الأقسام",
          impactEn: "Close success-index gap between departments",
        })
      );
    } else {
      actions.push(
        fromInsight(insight, {
          recommendationAr: `متابعة تنفيذية: ${insight.bodyAr}`,
          recommendationEn: `Executive follow-up: ${insight.bodyEn}`,
          domain: "talent",
          owner: "school_admin",
          effort: "low",
          timeline: "30 يوماً",
          timelineEn: "30 days",
          impactAr: "تحسين مستهدف حسب الرؤية المكتشفة",
          impactEn: "Targeted improvement per detected insight",
        })
      );
    }
  }

  for (const gap of intelligence.opportunityMapping.slice(0, 12)) {
    actions.push(fromOpportunityGap(gap));
  }

  for (const intervention of intelligence.interventions.filter((i) => i.severity === "high").slice(0, 15)) {
    actions.push({
      id: stableId(["action", intervention.studentId, intervention.interventionType]),
      sourceInsightId: intervention.studentId,
      titleAr: `تدخل طلابي: ${intervention.fullName}`,
      titleEn: `Student intervention: ${intervention.fullName}`,
      recommendationAr:
        intervention.interventionType === "participation_stop"
          ? "جلسة إرشاد فردية وإعادة ربط الطالب بفرصة مشاركة مناسبة"
          : intervention.interventionType === "readiness_drop"
            ? "خطة دعم جاهزية مهنية وجامعية مع متابعة شهرية"
            : "متابعة أسبوعية لاستعادة الزخم الأكاديمي",
      recommendationEn:
        intervention.interventionType === "participation_stop"
          ? "Individual counseling and re-link student to a suitable participation opportunity"
          : intervention.interventionType === "readiness_drop"
            ? "Career and university readiness support plan with monthly follow-up"
            : "Weekly follow-up to restore academic momentum",
      priority: intervention.severity === "high" ? "high" : "medium",
      expectedImpactAr: "منع مزيد من التراجع واستعادة المشاركة",
      expectedImpactEn: "Prevent further decline and restore participation",
      effort: "medium",
      owner: "counselor",
      ownerLabelAr: OWNER_LABELS.counselor.ar,
      ownerLabelEn: OWNER_LABELS.counselor.en,
      timeline: "21 يوماً",
      timelineEn: "21 days",
      domain:
        intervention.interventionType === "readiness_drop" ? "university_readiness" : "competitions",
      evidence: intervention.evidence,
      trackingStatus: "proposed",
    });
  }

  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
};
