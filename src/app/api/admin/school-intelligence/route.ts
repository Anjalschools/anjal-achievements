import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  buildSchoolIntelligenceApiPayload,
  createEmptySchoolIntelligencePayload,
  sanitizeSchoolIntelligenceDiagnostics,
} from "@/lib/school-intelligence/school-intelligence-hardening";
import { loadIntelligenceSnapshot } from "@/lib/school-improvement/intelligence-snapshot-store";
import {
  SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY,
  SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
} from "@/lib/school-intelligence/school-intelligence-boot";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const degradedFallback = async () => {
  const cached = await loadIntelligenceSnapshot<SchoolIntelligencePayload>(
    SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY,
    "full_payload"
  ).catch(() => null);

  if (cached) {
    return {
      success: true as const,
      ok: true as const,
      status: "degraded" as const,
      intelligence: cached,
      messageAr: "تم عرض آخر نسخة ناجحة من البيانات",
      messageEn: "Showing last successful snapshot",
      diagnostics: sanitizeSchoolIntelligenceDiagnostics({
        generatedAt: new Date().toISOString(),
        status: "degraded",
        totalDurationMs: 0,
        steps: [],
        warnings: [],
        snapshotFallback: true,
        messageAr: "تم عرض آخر نسخة ناجحة من البيانات",
        messageEn: "Showing last successful snapshot",
      }),
    };
  }

  return {
    success: true as const,
    ok: true as const,
    status: "unavailable" as const,
    intelligence: createEmptySchoolIntelligencePayload(),
    messageAr: "تعذر تحميل شبكة الذكاء المدرسي حالياً",
    messageEn: "School intelligence network is unavailable right now",
    diagnostics: sanitizeSchoolIntelligenceDiagnostics({
      generatedAt: new Date().toISOString(),
      status: "unavailable",
      totalDurationMs: 0,
      steps: [],
      warnings: [],
      snapshotFallback: false,
      messageAr: "تعذر تحميل شبكة الذكاء المدرسي حالياً",
      messageEn: "School intelligence network is unavailable right now",
    }),
  };
};

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!roleHasCapability(role, "advancedAnalytics")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return runHardenedRoute(request, {
    path: "/api/admin/school-intelligence",
    timeoutMs: 120_000,
    fallback: async () => degradedFallback(),
    handler: async () => {
      console.log("[SchoolIntelligence Route Active]", {
        runtimeVersion: SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
        path: "/api/admin/school-intelligence",
      });
      return buildSchoolIntelligenceApiPayload();
    },
  });
}
