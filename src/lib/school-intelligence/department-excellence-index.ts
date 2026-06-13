import type {
  DepartmentExcellenceRow,
  StudentSuccessGraphNode,
} from "@/lib/school-intelligence/school-intelligence-types";

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

const avg = (values: number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

const buildCohortIndex = (
  nodes: StudentSuccessGraphNode[],
  dimension: DepartmentExcellenceRow["dimension"],
  key: string,
  labelAr: string,
  labelEn: string,
  filter: (n: StudentSuccessGraphNode) => boolean
): DepartmentExcellenceRow | null => {
  const cohort = nodes.filter(filter);
  if (cohort.length === 0) return null;

  const avgSuccessIndex = avg(cohort.map((n) => n.successIndex));
  const avgParticipation = avg(cohort.map((n) => n.participationCount));
  const growthValues = cohort.map((n) => n.growthIndex ?? 0).filter((g) => g !== 0);
  const growthRatePct = growthValues.length ? clamp(avg(growthValues) * 20) : 0;
  const participationBonus = Math.min(15, clamp(avgParticipation * 2));
  const excellenceIndex = clamp(avgSuccessIndex * 0.75 + participationBonus + growthRatePct * 0.1);

  return {
    key,
    dimension,
    labelAr,
    labelEn,
    studentCount: cohort.length,
    avgSuccessIndex: clamp(avgSuccessIndex),
    avgParticipation: Math.round(avgParticipation * 10) / 10,
    growthRatePct,
    excellenceIndex,
    evidence: `students=${cohort.length}; avgSSI=${clamp(avgSuccessIndex)}; participation=${avgParticipation.toFixed(1)}`,
  };
};

export const buildDepartmentExcellenceIndex = (
  nodes: StudentSuccessGraphNode[]
): DepartmentExcellenceRow[] => {
  const rows: DepartmentExcellenceRow[] = [];

  const departmentDefs: Array<{ key: string; labelAr: string; labelEn: string; match: (n: StudentSuccessGraphNode) => boolean }> = [
    { key: "mawhiba", labelAr: "قسم الموهوبين", labelEn: "Gifted (Mawhiba)", match: (n) => n.department === "mawhiba" },
    { key: "general", labelAr: "القسم العام", labelEn: "General department", match: (n) => n.department === "general" },
  ];

  const trackDefs: Array<{ key: string; labelAr: string; labelEn: string; match: (n: StudentSuccessGraphNode) => boolean }> = [
    { key: "arabic", labelAr: "المسار العربي", labelEn: "Arabic track", match: (n) => n.track === "arabic" },
    { key: "international", labelAr: "المسار الدولي", labelEn: "International track", match: (n) => n.track === "international" },
  ];

  const stageDefs: Array<{ key: string; labelAr: string; labelEn: string; match: (n: StudentSuccessGraphNode) => boolean }> = [
    { key: "primary", labelAr: "المرحلة الابتدائية", labelEn: "Primary stage", match: (n) => n.stage === "primary" },
    { key: "middle", labelAr: "المرحلة المتوسطة", labelEn: "Middle stage", match: (n) => n.stage === "middle" },
    { key: "secondary", labelAr: "المرحلة الثانوية", labelEn: "Secondary stage", match: (n) => n.stage === "secondary" },
  ];

  for (const def of departmentDefs) {
    const row = buildCohortIndex(nodes, "department", def.key, def.labelAr, def.labelEn, def.match);
    if (row) rows.push(row);
  }
  for (const def of trackDefs) {
    const row = buildCohortIndex(nodes, "track", def.key, def.labelAr, def.labelEn, def.match);
    if (row) rows.push(row);
  }
  for (const def of stageDefs) {
    const row = buildCohortIndex(nodes, "stage", def.key, def.labelAr, def.labelEn, def.match);
    if (row) rows.push(row);
  }

  return rows.sort((a, b) => b.excellenceIndex - a.excellenceIndex);
};
