import { NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  getGovernanceProfile,
  parseGovernanceMode,
  type CompetitionGovernanceMode,
} from "@/lib/competition/governance/governance-modes";
import { DEFAULT_COMPETITION_SCALABILITY_POLICY } from "@/lib/competition/governance/scalability-policy";
import { DEFAULT_EXPORT_SAFETY_POLICY } from "@/lib/competition/governance/export-safety-policy";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { getCompetitionIntelAccess } from "@/lib/competition-intelligence-permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const mode = parseGovernanceMode(url.searchParams.get("mode"));
  const profile = getGovernanceProfile(mode);
  const access = getCompetitionIntelAccess(String(gate.user.role), mode);

  return NextResponse.json({
    ok: true,
    aggregationVersion: CI_AGGREGATION_VERSION,
    governanceMode: mode,
    profile,
    access,
    scalabilityPolicy: DEFAULT_COMPETITION_SCALABILITY_POLICY,
    exportSafetyPolicy: DEFAULT_EXPORT_SAFETY_POLICY,
    availableModes: [
      "executive_mode",
      "analytics_mode",
      "audit_mode",
      "readonly_presentation_mode",
    ] satisfies CompetitionGovernanceMode[],
  });
}
