import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import {
  buildAllAchievementsReportStats,
  buildCompetitionAchievementReportStats,
  buildFieldAchievementReportStats,
  buildStudentAchievementReportStats,
  buildUrgentReviewQueueStats,
} from "@/lib/achievement-admin-reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const type = String(searchParams.get("type") || "all").trim();

  try {
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
