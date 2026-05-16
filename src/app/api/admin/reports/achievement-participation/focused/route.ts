import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  buildFocusedActivityOptionsList,
  buildFocusedActivityReport,
  parseFocusedParams,
} from "@/lib/achievement-participation-focused-analytics";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  ciRedactLine,
  logAggregationHealth,
  type CiObservabilityMeta,
} from "@/lib/competition-intelligence-debug";

export const dynamic = "force-dynamic";

const buildObs = (p: {
  serverFacetMs: number;
  cacheHit: boolean;
  cacheAgeMs: number;
  recomputeReason?: CiObservabilityMeta["recomputeReason"];
}): CiObservabilityMeta => ({
  generatedAt: new Date().toISOString(),
  serverFacetMs: p.serverFacetMs,
  cacheHit: p.cacheHit,
  cacheAgeMs: p.cacheAgeMs,
  source: "none",
  recomputeReason: p.recomputeReason,
});

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseFocusedParams(searchParams);

    if (parsed.listOptions) {
      const t0 = Date.now();
      const activityOptions = await buildFocusedActivityOptionsList(parsed.filters);
      const ms = Date.now() - t0;
      logAggregationHealth({
        facet: "focused_activity_options",
        durationMs: ms,
        filterSummary: ciRedactLine(JSON.stringify(parsed.filters)),
        resultSize: activityOptions.length,
        cacheStatus: "none",
      });
      return NextResponse.json({
        ok: true as const,
        generatedAt: new Date().toISOString(),
        filters: parsed.filters,
        activityOptions,
        ciObservability: buildObs({
          serverFacetMs: ms,
          cacheHit: false,
          cacheAgeMs: 0,
          recomputeReason: "cold",
        }),
      });
    }

    if (!parsed.focusType) {
      return NextResponse.json(
        {
          error: "focusType required",
          hint: "Pass focusType + focusRaw (from activityOptions), or listOptions=1 to load options.",
        },
        { status: 400 }
      );
    }

    const exportAll = searchParams.get("exportParticipants") === "1";
    const exportMax = Math.min(2000, Math.max(1, parseInt(searchParams.get("exportMax") || "800", 10) || 800));

    const t0 = Date.now();
    const payload = await buildFocusedActivityReport({
      filters: parsed.filters,
      focusType: parsed.focusType,
      focusRaw: parsed.focusRaw,
      focusedOutcome: parsed.focusedOutcome,
      page: exportAll ? 1 : parsed.page,
      pageSize: exportAll ? exportMax : parsed.pageSize,
    });
    const ms = Date.now() - t0;
    logAggregationHealth({
      facet: exportAll ? "focused_participant_export" : "focused_activity_report",
      durationMs: ms,
      filterSummary: ciRedactLine(JSON.stringify({ f: parsed.filters, ft: parsed.focusType, out: parsed.focusedOutcome })),
      resultSize: payload.totalParticipants,
      cacheStatus: "none",
    });

    return NextResponse.json(
      {
        ...payload,
        ciObservability: buildObs({
          serverFacetMs: ms,
          cacheHit: false,
          cacheAgeMs: 0,
          recomputeReason: "cold",
        }),
      },
      {
        headers: { "Cache-Control": "private, max-age=15" },
      }
    );
  } catch (e) {
    console.error("[GET /api/admin/reports/achievement-participation/focused]", e);
    return jsonInternalServerError(e);
  }
}
