import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { buildSchoolImprovementIntelligence } from "@/lib/school-improvement/school-improvement-service";
import { sanitizeDiagnosticsForProduction } from "@/lib/school-improvement/intelligence-diagnostics-builder";
import {
  clearIntelligenceSnapshot,
  clearStaleIntelligenceSnapshots,
} from "@/lib/school-improvement/intelligence-snapshot-store";
import { runWithIntelligenceDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isSystemAdmin = (role: string) => String(role || "").trim() === "admin";

type ActionBody = {
  action?: "retry_section" | "refresh_snapshot" | "clear_snapshot" | "clear_stale_snapshots" | "rerun_diagnostics";
  section?: string;
};

export async function POST(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!isSystemAdmin(role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as ActionBody;
  const action = String(body.action || "").trim();

  if (action === "rerun_diagnostics") {
    const result = await runWithIntelligenceDiagnostics(() => buildSchoolImprovementIntelligence());
    return NextResponse.json({
      success: true,
      diagnostics: sanitizeDiagnosticsForProduction(result.diagnostics),
    });
  }

  if (action === "clear_stale_snapshots") {
    const deletedCount = await clearStaleIntelligenceSnapshots(30 * 24 * 60 * 60 * 1000);
    return NextResponse.json({ success: true, deletedCount });
  }

  const section = String(body.section || "").trim();
  if (!section && action !== "clear_stale_snapshots") {
    return NextResponse.json({ success: false, error: "section is required" }, { status: 400 });
  }

  if (action === "clear_snapshot") {
    await clearIntelligenceSnapshot(section, "section");
    return NextResponse.json({ success: true, section, cleared: true });
  }

  if (action === "refresh_snapshot" || action === "retry_section") {
    const result = await runWithIntelligenceDiagnostics(() => buildSchoolImprovementIntelligence());
    const sectionHealth = result.diagnostics.sections[section];
    if (!sectionHealth || sectionHealth.status === "unavailable") {
      return NextResponse.json(
        { success: false, error: "Section not healthy enough to refresh snapshot", sectionHealth },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      section,
      action,
      sectionHealth,
      refreshedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
