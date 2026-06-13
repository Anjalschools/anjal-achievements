import type { ImprovementAction, ImprovementPlan } from "@/lib/school-improvement/school-improvement-types";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

const DOMAIN_META: Record<
  ImprovementPlan["domain"],
  { titleAr: string; titleEn: string; objectiveAr: string; objectiveEn: string }
> = {
  talent: {
    titleAr: "خطة تحسين الموهبة",
    titleEn: "Talent improvement plan",
    objectiveAr: "اكتشاف المواهب ودعم النمو السريع",
    objectiveEn: "Discover talents and support rapid growth",
  },
  competitions: {
    titleAr: "خطة تحسين المسابقات",
    titleEn: "Competitions improvement plan",
    objectiveAr: "رفع المشاركة والجودة في المسابقات",
    objectiveEn: "Raise competition participation and quality",
  },
  training: {
    titleAr: "خطة تحسين التدريب",
    titleEn: "Training improvement plan",
    objectiveAr: "توسيع فرص التدريب وربطها بالجاهزية المهنية",
    objectiveEn: "Expand training opportunities linked to career readiness",
  },
  volunteer: {
    titleAr: "خطة تحسين التطوع",
    titleEn: "Volunteer improvement plan",
    objectiveAr: "زيادة ساعات التطوع المعتمدة",
    objectiveEn: "Increase verified volunteer hours",
  },
  career_readiness: {
    titleAr: "خطة الجاهزية المهنية",
    titleEn: "Career readiness plan",
    objectiveAr: "رفع مؤشر الجاهزية المهنية للطلاب",
    objectiveEn: "Raise student career readiness index",
  },
  university_readiness: {
    titleAr: "خطة الجاهزية الجامعية",
    titleEn: "University readiness plan",
    objectiveAr: "تعزيز الجاهزية الجامعية والمسارات الأكاديمية",
    objectiveEn: "Strengthen university readiness and academic pathways",
  },
};

const planPriority = (actions: ImprovementAction[]): ImprovementPlan["priority"] => {
  if (actions.some((a) => a.priority === "high")) return "high";
  if (actions.some((a) => a.priority === "medium")) return "medium";
  return "low";
};

export const buildImprovementPlans = (
  intelligence: SchoolIntelligencePayload,
  actions: ImprovementAction[]
): ImprovementPlan[] => {
  const domains = Object.keys(DOMAIN_META) as ImprovementPlan["domain"][];

  return domains
    .map((domain) => {
      const domainActions = actions.filter((a) => a.domain === domain);
      const meta = DOMAIN_META[domain];
      if (domainActions.length === 0) {
        const fallbackNeeded =
          domain === "talent" ||
          domain === "competitions" ||
          domain === "training" ||
          (domain === "volunteer" && intelligence.schoolExcellence.participationRatePct < 60) ||
          (domain === "career_readiness" && intelligence.studentSuccessGraph.avgSuccessIndex < 55) ||
          (domain === "university_readiness" && intelligence.studentSuccessGraph.avgSuccessIndex < 55);

        if (!fallbackNeeded) return null;

        const ownerForDomain: ImprovementAction["owner"] =
          domain === "training" || domain === "volunteer" ? "partnerships" : "career_guidance";
        const fallbackAction: ImprovementAction = {
          id: `plan-fallback-${domain}`,
          sourceInsightId: "school-summary",
          titleAr: meta.titleAr,
          titleEn: meta.titleEn,
          recommendationAr: meta.objectiveAr,
          recommendationEn: meta.objectiveEn,
          priority: "medium",
          expectedImpactAr: "تحسين تدريجي في المجال",
          expectedImpactEn: "Gradual domain improvement",
          effort: "medium",
          owner: ownerForDomain,
          ownerLabelAr: ownerForDomain === "partnerships" ? "منسق الشراكات" : "التوجيه المهني",
          ownerLabelEn: ownerForDomain === "partnerships" ? "Partnerships coordinator" : "Career guidance",
          timeline: "فصل دراسي",
          timelineEn: "One term",
          domain,
          evidence: [{ label: "avgSuccessIndex", value: intelligence.studentSuccessGraph.avgSuccessIndex }],
          trackingStatus: "proposed",
        };
        domainActions.push(fallbackAction);
      }

      if (domainActions.length === 0) return null;

      return {
        id: `plan-${domain}`,
        domain,
        titleAr: meta.titleAr,
        titleEn: meta.titleEn,
        objectiveAr: meta.objectiveAr,
        objectiveEn: meta.objectiveEn,
        actions: domainActions.slice(0, 8),
        priority: planPriority(domainActions),
        evidence: `actions=${domainActions.length}; schoolExcellence=${intelligence.schoolExcellence.excellenceIndex}`,
      };
    })
    .filter((p): p is ImprovementPlan => p !== null);
};
