import type { DepartmentActionPlan, ImprovementAction } from "@/lib/school-improvement/school-improvement-types";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

export const buildDepartmentActionPlans = (
  intelligence: SchoolIntelligencePayload,
  actions: ImprovementAction[]
): DepartmentActionPlan[] => {
  const schoolAvg = intelligence.schoolExcellence.excellenceIndex;

  return intelligence.departmentExcellence.map((dept) => {
    const gap = Math.max(0, schoolAvg - dept.excellenceIndex);
    const targetIndex = Math.min(100, Math.round(dept.excellenceIndex + gap * 0.6));

    const deptActions = actions
      .filter((a) => {
        const label = `${dept.labelAr} ${dept.labelEn} ${dept.key}`.toLowerCase();
        return (
          a.recommendationAr.includes(dept.labelAr) ||
          a.recommendationEn.toLowerCase().includes(dept.key) ||
          label.includes(a.domain)
        );
      })
      .slice(0, 5);

    const fallback: ImprovementAction[] =
      deptActions.length > 0
        ? deptActions
        : [
            {
              id: `dept-plan-${dept.key}-${dept.dimension}`,
              sourceInsightId: dept.key,
              titleAr: `تحسين ${dept.labelAr}`,
              titleEn: `Improve ${dept.labelEn}`,
              recommendationAr: `خطة رفع مؤشر التميز من ${dept.excellenceIndex} إلى ${targetIndex}`,
              recommendationEn: `Raise excellence index from ${dept.excellenceIndex} to ${targetIndex}`,
              priority: gap >= 15 ? "high" : "medium",
              expectedImpactAr: `تحسين المشاركة والنجاح لـ ${dept.studentCount} طالب`,
              expectedImpactEn: `Improve participation and success for ${dept.studentCount} students`,
              effort: "medium",
              owner: dept.dimension === "department" ? "department_head" : "activities_coordinator",
              ownerLabelAr: dept.dimension === "department" ? "رئيس القسم" : "منسق الأنشطة",
              ownerLabelEn: dept.dimension === "department" ? "Department head" : "Activities coordinator",
              timeline: "فصل دراسي",
              timelineEn: "One term",
              domain:
                dept.key === "mawhiba"
                  ? "talent"
                  : dept.dimension === "stage"
                    ? "competitions"
                    : "training",
              evidence: [{ label: "excellenceIndex", value: dept.excellenceIndex }],
              trackingStatus: "proposed",
            },
          ];

    return {
      key: `${dept.dimension}-${dept.key}`,
      dimension: dept.dimension,
      labelAr: dept.labelAr,
      labelEn: dept.labelEn,
      currentIndex: dept.excellenceIndex,
      targetIndex,
      actions: fallback,
      timeline: gap >= 15 ? "فصلان" : "فصل دراسي",
    };
  });
};
