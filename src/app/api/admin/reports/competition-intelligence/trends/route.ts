import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { listCompetitionTrendRecords } from "@/lib/competition/analytics/trend-persistence";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { clampTrendYears } from "@/lib/competition/governance/scalability-policy";

export const dynamic = "force-dynamic";

type TrendApiRow = {
  academicYear: number;
  records: number;
  distinctStudents: number;
  goldMedals: number;
  silverMedals: number;
  bronzeMedals: number;
  totalMedals: number;
  internationalParticipants: number;
  mawhibaParticipants: number;
  divisionPerformance: Array<{ key: string; records: number; medals: number }>;
  schoolPerformance: Array<{ key: string; records: number; medals: number }>;
  aggregationVersion: number;
  computedAt: Date;
};

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = Math.min(30, Math.max(2, Number(request.nextUrl.searchParams.get("limit")) || 12));

  try {
    await connectDB();
    const rows = await listCompetitionTrendRecords(limit);
    const mapped: TrendApiRow[] = rows.map((r) => ({
      academicYear: r.academicYear,
      records: r.records,
      distinctStudents: r.distinctStudents,
      goldMedals: r.goldMedals,
      silverMedals: r.silverMedals,
      bronzeMedals: r.bronzeMedals,
      totalMedals: r.totalMedals,
      internationalParticipants: r.internationalParticipants,
      mawhibaParticipants: r.mawhibaParticipants,
      divisionPerformance: r.divisionPerformance ?? [],
      schoolPerformance: r.schoolPerformance ?? [],
      aggregationVersion: r.aggregationVersion ?? CI_AGGREGATION_VERSION,
      computedAt: r.computedAt,
    }));
    const clamped = clampTrendYears(mapped.map((r) => ({ ...r, year: r.academicYear })));

    const sorted = [...(clamped.value as TrendApiRow[])].sort((a, b) => a.academicYear - b.academicYear);
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const participationGrowthPct =
      latest && prev && prev.records > 0 ?
        Math.round(((latest.records - prev.records) / prev.records) * 1000) / 10
      : null;
    const medalsGrowthPct =
      latest && prev && prev.totalMedals > 0 ?
        Math.round(((latest.totalMedals - prev.totalMedals) / prev.totalMedals) * 1000) / 10
      : null;

    return NextResponse.json({
      ok: true,
      aggregationVersion: CI_AGGREGATION_VERSION,
      trends: sorted,
      summary: {
        participationGrowthPct,
        medalsGrowthPct,
        internationalGrowthPct:
          latest && prev && prev.internationalParticipants > 0 ?
            Math.round(
              ((latest.internationalParticipants - prev.internationalParticipants) /
                prev.internationalParticipants) *
                1000
            ) / 10
          : null,
        mawhibaGrowthPct:
          latest && prev && prev.mawhibaParticipants > 0 ?
            Math.round(
              ((latest.mawhibaParticipants - prev.mawhibaParticipants) / prev.mawhibaParticipants) * 1000
            ) / 10
          : null,
      },
      truncated: clamped.truncated,
    });
  } catch (e) {
    console.error("[GET competition-intelligence/trends]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
