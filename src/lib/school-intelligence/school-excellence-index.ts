import type {
  DepartmentExcellenceRow,
  SchoolExcellenceSummary,
  StudentSuccessGraphNode,
} from "@/lib/school-intelligence/school-intelligence-types";

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
const avg = (values: number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

export const buildSchoolExcellenceIndex = (
  nodes: StudentSuccessGraphNode[],
  departmentRows: DepartmentExcellenceRow[],
  yearOverYearGrowthPct: number
): SchoolExcellenceSummary => {
  const totalStudents = nodes.length;
  const activeParticipants = nodes.filter((n) => n.participationCount > 0).length;
  const participationRatePct =
    totalStudents > 0 ? clamp((activeParticipants / totalStudents) * 100) : 0;
  const avgStudentSuccessIndex = clamp(avg(nodes.map((n) => n.successIndex)));

  const deptAvg =
    departmentRows.length > 0
      ? avg(departmentRows.map((r) => r.excellenceIndex))
      : avgStudentSuccessIndex;

  const excellenceIndex = clamp(
    deptAvg * 0.5 + avgStudentSuccessIndex * 0.3 + participationRatePct * 0.15 + yearOverYearGrowthPct * 0.05
  );

  return {
    excellenceIndex,
    avgStudentSuccessIndex,
    totalStudents,
    activeParticipants,
    participationRatePct,
    yearOverYearGrowthPct,
    evidence: `deptAvg=${Math.round(deptAvg)}; avgSSI=${avgStudentSuccessIndex}; participation=${participationRatePct}%`,
  };
};
