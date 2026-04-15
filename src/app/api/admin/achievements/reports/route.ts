import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  buildAllAchievementsReportStats,
  buildUnifiedAdminAchievementReports,
  buildCompetitionAchievementReportStats,
  buildFieldAchievementReportStats,
  buildStudentAchievementReportStats,
  buildUrgentReviewQueueStats,
} from "@/lib/achievement-admin-reports";
import { parseReportCsvParam } from "@/lib/report-filter-options";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = String(searchParams.get("type") || "all").trim();
  const unified = searchParams.get("view") === "unified";

  try {
    if (unified) {
      const payload = await buildUnifiedAdminAchievementReports({
        academicYear: String(searchParams.get("academicYear") || "").trim() || undefined,
        gender: String(searchParams.get("gender") || "").trim() || undefined,
        mawhiba: String(searchParams.get("mawhiba") || "").trim() || undefined,
        stage: String(searchParams.get("stage") || "").trim() || undefined,
        grade: String(searchParams.get("grade") || "").trim() || undefined,
        categories: parseReportCsvParam(searchParams.get("category")),
        achievementName: String(searchParams.get("achievementName") || "").trim() || undefined,
        levels: parseReportCsvParam(searchParams.get("level")),
        resultTokens: parseReportCsvParam(searchParams.get("result")),
        status: String(searchParams.get("status") || "").trim() || undefined,
        certificateStatus: String(searchParams.get("certificateStatus") || "").trim() || undefined,
        fromDate: String(searchParams.get("fromDate") || "").trim() || undefined,
        toDate: String(searchParams.get("toDate") || "").trim() || undefined,
      });
      return NextResponse.json({ ok: true, ...payload });
    }

    if (type === "all") {
      const stats = await buildAllAchievementsReportStats();
      return NextResponse.json({ ok: true, stats });
    }
    if (type === "urgent") {
      const stats = await buildUrgentReviewQueueStats();
      return NextResponse.json({ ok: true, stats });
    }
    if (type === "student") {
      const studentId = String(searchParams.get("studentId") || "").trim();
      if (!studentId) {
        return NextResponse.json({ error: "studentId is required" }, { status: 400 });
      }
      const stats = await buildStudentAchievementReportStats(studentId);
      if (!stats) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, stats });
    }
    if (type === "field") {
      const field = String(searchParams.get("field") || "").trim();
      if (!field) {
        return NextResponse.json({ error: "field is required" }, { status: 400 });
      }
      const stats = await buildFieldAchievementReportStats(field);
      if (!stats) {
        return NextResponse.json({ error: "Invalid field" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, stats });
    }
    if (type === "competition") {
      const key = String(searchParams.get("key") || "").trim();
      if (!key) {
        return NextResponse.json({ error: "key is required" }, { status: 400 });
      }
      const stats = await buildCompetitionAchievementReportStats(key);
      if (!stats) {
        return NextResponse.json({ error: "Invalid key" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, stats });
    }

    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  } catch (e) {
    console.error("[GET admin achievements reports]", e);
    return jsonInternalServerError(e);
  }
}
