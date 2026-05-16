/**
 * Future-ready capability matrix for competition intelligence.
 * Current policy: same access as existing achievement reports (no gating yet).
 */

export type CompetitionIntelCapability =
  | "view_reports"
  | "export_reports"
  | "executive_reports"
  | "compare_activities"
  | "student_intelligence";

export type CompetitionIntelAccess = Record<CompetitionIntelCapability, boolean>;

const ALL_TRUE: CompetitionIntelAccess = {
  view_reports: true,
  export_reports: true,
  executive_reports: true,
  compare_activities: true,
  student_intelligence: true,
};

/**
 * Resolve fine-grained competition intel access.
 * Today: all capabilities allowed for any authenticated report viewer.
 * Later: branch on `role` and school scope without changing call sites.
 */
export const getCompetitionIntelAccess = (_userRole: string | undefined): CompetitionIntelAccess => ALL_TRUE;

export const assertCompetitionIntelCapability = (
  access: CompetitionIntelAccess,
  cap: CompetitionIntelCapability
): boolean => access[cap] === true;
