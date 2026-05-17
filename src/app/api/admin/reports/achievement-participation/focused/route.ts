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
  logCompareOverloadIntel,
  type CiObservabilityMeta,
} from "@/lib/competition-intelligence-debug";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { clampParticipantExportMax } from "@/lib/competition/governance/scalability-policy";
import { createCorrelationId } from "@/lib/competition-intelligence-debug";
import { DEFAULT_AGGREGATION_TIMEOUT_MS, withTimeout } from "@/lib/resilience/query-safety";
import { inferRouteErrorCause, logRouteError, payloadByteSize } from "@/lib/resilience/route-error-log";

export const dynamic = "force-dynamic";
const ROUTE_PATH = "/api/admin/reports/achievement-participation/focused";

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
  aggregationVersion: CI_AGGREGATION_VERSION,
});

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const correlationId = request.headers.get("x-correlation-id")?.trim() || createCorrelationId();
  const routeT0 = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseFocusedParams(searchParams);

    if (parsed.listOptions) {
      const t0 = Date.now();
      const activityOptions = await withTimeout(
        "focused_activity_options",
        DEFAULT_AGGREGATION_TIMEOUT_MS,
        async () => buildFocusedActivityOptionsList(parsed.filters)
      );
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
    const exportMaxRequested = Math.max(1, parseInt(searchParams.get("exportMax") || "800", 10) || 800);
    const exportMax = clampParticipantExportMax(exportMaxRequested);
    if (exportMax < exportMaxRequested) {
      logCompareOverloadIntel({ compareCount: exportMaxRequested, maxAllowed: exportMax });
    }

    const t0 = Date.now();
    const payload = await withTimeout(
      exportAll ? "focused_participant_export" : "focused_activity_report",
      DEFAULT_AGGREGATION_TIMEOUT_MS,
      async () =>
        buildFocusedActivityReport({
          filters: parsed.filters,
          focusType: parsed.focusType,
          focusRaw: parsed.focusRaw,
          focusedOutcome: parsed.focusedOutcome,
          page: exportAll ? 1 : parsed.page,
          pageSize: exportAll ? exportMax : parsed.pageSize,
        })
    );
    const ms = Date.now() - t0;
    logAggregationHealth({
      facet: exportAll ? "focused_participant_export" : "focused_activity_report",
      durationMs: ms,
      filterSummary: ciRedactLine(JSON.stringify({ f: parsed.filters, ft: parsed.focusType, out: parsed.focusedOutcome })),
      resultSize: payload.totalParticipants,
      cacheStatus: "none",
      correlationId,
      payloadBytes: payloadByteSize(payload),
      degradedMode: exportMax < exportMaxRequested,
    });

    const res = NextResponse.json(
      {
        ...payload,
        ...(exportMax < exportMaxRequested ? { degraded: true as const } : {}),
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
    res.headers.set("X-Correlation-Id", correlationId);
    if (exportMax < exportMaxRequested) res.headers.set("X-Degraded", "1");
    return res;
  } catch (e) {
    logRouteError({
      path: ROUTE_PATH,
      durationMs: Date.now() - routeT0,
      correlationId,
      cause: inferRouteErrorCause(e, Date.now() - routeT0),
      aggregation: "focused_activity_report",
      message: e instanceof Error ? e.message : "Error",
    });
    const res = jsonInternalServerError(e, { merge: { correlationId } });
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  }
}
