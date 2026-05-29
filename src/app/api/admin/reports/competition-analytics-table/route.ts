import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { parseParticipationFiltersFromSearchParams } from "@/lib/achievement-participation-analytics";
import { buildCompetitionTableFromDb } from "@/lib/competitions/competition-table-aggregator";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const competition = String(searchParams.get("competition") || "").trim();
    if (!competition) {
      return NextResponse.json({ ok: false, error: "competition required" }, { status: 400 });
    }

    const yearsRaw = String(searchParams.get("years") || "").trim();
    const years =
      yearsRaw ?
        yearsRaw
          .split(",")
          .map((y) => parseInt(y, 10))
          .filter((y) => y >= 2018 && y <= 2035)
      : [];

    const filters = parseParticipationFiltersFromSearchParams(searchParams);
    const dimension = String(searchParams.get("dimension") || "combined").trim() as
      | "combined"
      | "girls"
      | "boys";

    const model = await buildCompetitionTableFromDb({
      competitionKey: competition,
      years,
      filters,
    });

    if (!model) {
      return NextResponse.json({ ok: false, error: "Unknown competition" }, { status: 404 });
    }

    const queryKey = [
      "competition-table",
      competition,
      (years.length > 0 ? years : model.years).sort((a, b) => a - b).join(","),
      searchParams.toString(),
    ].join("|");

    return NextResponse.json({
      ok: true,
      model,
      queryKey,
      competitionKey: competition,
      years: model.years,
      generatedAt: model.generatedAt,
    });
  } catch (e) {
    return jsonInternalServerError(e);
  }
}
