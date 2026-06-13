import type { OpportunityRecommendation } from "@/lib/school-improvement/school-improvement-types";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

export const buildOpportunityRecommendations = (
  intelligence: SchoolIntelligencePayload
): OpportunityRecommendation[] => {
  const recs: OpportunityRecommendation[] = [];

  for (const gap of intelligence.opportunityMapping.slice(0, 10)) {
    if (gap.dimension === "activity") {
      recs.push({
        id: `opp-comp-${gap.key}`,
        type: "competition",
        titleAr: `إعادة تفعيل: ${gap.labelAr}`,
        titleEn: `Re-activate: ${gap.labelEn}`,
        reasonAr: gap.recommendationAr,
        reasonEn: gap.recommendationEn,
        priority: gap.gapPct >= 35 ? "high" : "medium",
        targetCohort: gap.labelAr,
        evidence: [
          { label: "gapPct", value: gap.gapPct },
          { label: "participantCount", value: gap.participantCount },
        ],
      });
    } else if (gap.dimension === "institution") {
      recs.push({
        id: `opp-partner-${gap.key}`,
        type: "partnership",
        titleAr: `شراكة موسّعة مع ${gap.labelAr}`,
        titleEn: `Expanded partnership with ${gap.labelEn}`,
        reasonAr: "ربط المؤسسة بمراحل ذات فجوة مشاركة",
        reasonEn: "Link institution to stages with participation gaps",
        priority: "medium",
        targetCohort: gap.labelAr,
        evidence: [{ label: "opportunityCount", value: gap.opportunityCount }],
      });
    } else if (gap.dimension === "stage") {
      recs.push({
        id: `opp-program-${gap.key}`,
        type: "program",
        titleAr: `برنامج موجه لـ ${gap.labelAr}`,
        titleEn: `Targeted program for ${gap.labelEn}`,
        reasonAr: gap.recommendationAr,
        reasonEn: gap.recommendationEn,
        priority: gap.gapPct >= 30 ? "high" : "medium",
        targetCohort: gap.labelAr,
        evidence: [{ label: "gapPct", value: gap.gapPct }],
      });
    }
  }

  const lowSecondary = intelligence.departmentExcellence.find(
    (d) => d.key === "secondary" && d.dimension === "stage"
  );
  if (lowSecondary && lowSecondary.excellenceIndex < 65) {
    recs.push({
      id: "opp-program-secondary-bebras",
      type: "competition",
      titleAr: "توسيع مشاركة بيبراس في المرحلة الثانوية",
      titleEn: "Expand Bebras participation in secondary",
      reasonAr: "فجوة مشاركة في المرحلة الثانوية — بيبراس مدخل منخفض الجهد",
      reasonEn: "Secondary participation gap — Bebras is a low-effort entry point",
      priority: "high",
      targetCohort: "secondary",
      evidence: [{ label: "excellenceIndex", value: lowSecondary.excellenceIndex }],
    });
  }

  const mawhiba = intelligence.departmentExcellence.find((d) => d.key === "mawhiba");
  if (mawhiba && mawhiba.avgSuccessIndex >= 60) {
    recs.push({
      id: "opp-program-mawhiba-advanced",
      type: "program",
      titleAr: "برنامج موهبة متقدم للمرشحين",
      titleEn: "Advanced gifted program for candidates",
      reasonAr: `${mawhiba.studentCount} طالب في قسم الموهوبين بمتوسط نجاح ${mawhiba.avgSuccessIndex}`,
      reasonEn: `${mawhiba.studentCount} gifted students with avg success ${mawhiba.avgSuccessIndex}`,
      priority: "medium",
      targetCohort: "mawhiba",
      evidence: [{ label: "avgSuccessIndex", value: mawhiba.avgSuccessIndex }],
    });
  }

  return recs.slice(0, 20);
};
