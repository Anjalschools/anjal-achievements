import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { buildAdminReportSearchParams } from "@/lib/analytics/report-filter-params";

/** Build URLSearchParams for participation analytics APIs (multi-filter + CI extras). */
export const buildParticipationFilterSearchParams = (
  f: ExecutiveFilterSnapshot
): URLSearchParams => {
  const params = buildAdminReportSearchParams(f as unknown as Record<string, unknown>);

  const set = (k: string, v: string) => {
    if (v) params.set(k, v);
  };

  set("academicYear", f.academicYear || "2025-2026م");

  if (f.sections.length > 0) {
    params.set("sections", f.sections.join(","));
  } else if (f.section && f.section !== "all") {
    params.set("section", f.section);
  }

  if (f.primaryType && f.primaryType !== "all") {
    params.set("primaryType", f.primaryType);
  }

  const domain = String(f.domain || "").trim();
  if (domain) params.set("domain", domain);

  const classification = String(f.classification || "").trim();
  if (classification) params.set("classification", classification);

  const organization = String(f.organization || "").trim();
  if (organization) params.set("organization", organization);

  return params;
};

export const defaultAnalyticsFilterState = (): ExecutiveFilterSnapshot => ({
  academicYear: "2025-2026م",
  gender: "all",
  mawhiba: "all",
  stage: "all",
  grade: "all",
  section: "all",
  categories: [],
  primaryType: "all",
  levels: [],
  resultTokens: [],
  status: "all",
  certificateStatus: "all",
  fromDate: "",
  toDate: "",
  domain: "",
  classification: "",
  organization: "",
  activityYears: [],
  achievementNames: [],
  genders: [],
  mawhibaValues: [],
  stages: [],
  grades: [],
  sections: [],
  statuses: [],
  certificateStatuses: [],
  standardizedTestTypes: [],
});
