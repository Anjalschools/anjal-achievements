import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  buildFocusedActivityOptionsList,
  buildFocusedActivityFacet,
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
import { CiRouteMemoryCache } from "@/lib/competition/cache/cache-lifecycle";
import {
  trimFocusedPayloadForTransport,
  validateFocusedPayloadSize,
  warnFocusedPayloadOverflow,
} from "@/lib/analytics/focused-payload-governor";
import { enforceFocusedFacetBudget } from "@/lib/analytics/runtime/focused-facet-budget";
import {
  logFocusedAggregationStart,
  readFocusedRuntimeSnapshot,
  recordFocusedAggregationTiming,
} from "@/lib/analytics/focused-runtime-guard";

export const dynamic = "force-dynamic";
const ROUTE_PATH = "/api/admin/reports/achievement-participation/focused";

const focusedOptionsCache = new CiRouteMemoryCache<Awaited<ReturnType<typeof buildFocusedActivityOptionsList>>>({
  softTtlMs: 60_000,
  staleTtlMs: 180_000,
  maxEntries: 60,
});

const focusedReportCache = new CiRouteMemoryCache<unknown>({
  softTtlMs: 45_000,
  staleTtlMs: 150_000,
  maxEntries: 50,
});

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
    const scope = (searchParams.get("scope") || "full").trim().toLowerCase();

    if (parsed.listOptions) {
      const t0 = Date.now();
      const bypass = searchParams.get("nocache") === "1";
      const cacheKey = JSON.stringify({ f: parsed.filters });
      if (!bypass) {
        const resolved = focusedOptionsCache.get(cacheKey);
        if (resolved.hit && resolved.payload) {
          return NextResponse.json(
            {
              ok: true as const,
              generatedAt: new Date().toISOString(),
              filters: parsed.filters,
              activityOptions: resolved.payload,
              ciObservability: buildObs({
                serverFacetMs: 0,
                cacheHit: true,
                cacheAgeMs: resolved.ageMs,
                recomputeReason: resolved.shouldRevalidate ? "stale_revalidate" : undefined,
              }),
            },
            {
              headers: {
                "Cache-Control": "private, max-age=30",
                "X-Correlation-Id": correlationId,
                "X-CI-Cache-Lifecycle": resolved.status,
              },
            }
          );
        }
      }

      const activityOptions = await withTimeout(
        "focused_activity_options",
        DEFAULT_AGGREGATION_TIMEOUT_MS,
        async () => buildFocusedActivityOptionsList(parsed.filters)
      );
      const ms = Date.now() - t0;
      if (!bypass) focusedOptionsCache.set(cacheKey, activityOptions, "synced");
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
          recomputeReason: bypass ? "nocache_bypass" : "cache_miss",
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

    const bypass = searchParams.get("nocache") === "1";
    const reportKey = JSON.stringify({
      f: parsed.filters,
      ft: parsed.focusType,
      fr: parsed.focusRaw,
      out: parsed.focusedOutcome,
      p: exportAll ? 1 : parsed.page,
      ps: exportAll ? exportMax : parsed.pageSize,
      exp: exportAll ? 1 : 0,
      scope,
    });

    if (!bypass && !exportAll) {
      const resolved = focusedReportCache.get(reportKey);
      if (resolved.hit && resolved.payload) {
        const res = NextResponse.json(
          {
            ...resolved.payload,
            ciObservability: buildObs({
              serverFacetMs: 0,
              cacheHit: true,
              cacheAgeMs: resolved.ageMs,
              recomputeReason: resolved.shouldRevalidate ? "stale_revalidate" : undefined,
            }),
          },
          {
            headers: {
              "Cache-Control": "private, max-age=20",
              "X-Correlation-Id": correlationId,
              "X-CI-Cache-Lifecycle": resolved.status,
            },
          }
        );
        res.headers.set("X-Correlation-Id", correlationId);
        return res;
      }
    }

    const runtimeBefore = readFocusedRuntimeSnapshot();
    logFocusedAggregationStart(scope, correlationId);
    const t0 = Date.now();
    let payload = await withTimeout(
      exportAll ? "focused_participant_export" : `focused_activity_${scope}`,
      DEFAULT_AGGREGATION_TIMEOUT_MS,
      async () =>
        buildFocusedActivityFacet({
          scope: (scope as any) || "full",
          filters: parsed.filters,
          focusType: parsed.focusType,
          focusRaw: parsed.focusRaw,
          focusedOutcome: parsed.focusedOutcome,
          page: exportAll ? 1 : parsed.page,
          pageSize: exportAll ? exportMax : parsed.pageSize,
        })
    );
    const ms = Date.now() - t0;
    recordFocusedAggregationTiming({
      scope,
      durationMs: ms,
      correlationId,
      rowCount:
        typeof (payload as { totalParticipants?: unknown }).totalParticipants === "number"
          ? (payload as { totalParticipants: number }).totalParticipants
          : undefined,
    });

    const facetBudget = enforceFocusedFacetBudget(scope, payload, { correlationId });
    payload = facetBudget.payload as typeof payload;

    const governance = validateFocusedPayloadSize(payload, { scope, correlationId });
    warnFocusedPayloadOverflow(governance.bytes, scope, correlationId);
    if (governance.level !== "ok") {
      payload = trimFocusedPayloadForTransport(
        payload as Record<string, unknown>,
        governance
      ) as typeof payload;
    }
    const budgetDegraded = facetBudget.degraded || governance.level !== "ok";
    if (governance.blocked && !exportAll) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "Report payload exceeded safe limits. Narrow filters or use export.",
          correlationId,
          degraded: true,
          scope,
        },
        { status: 413, headers: { "X-Correlation-Id": correlationId, "X-Degraded": "1" } }
      );
    }

    if (!bypass && !exportAll) focusedReportCache.set(reportKey, payload, "synced");
    const resultSize =
      typeof (payload as { totalParticipants?: unknown }).totalParticipants === "number"
        ? ((payload as { totalParticipants: number }).totalParticipants)
        : Array.isArray((payload as { participants?: unknown }).participants)
          ? ((payload as { participants: unknown[] }).participants.length)
          : 0;
    logAggregationHealth({
      facet: exportAll ? "focused_participant_export" : "focused_activity_report",
      durationMs: ms,
      filterSummary: ciRedactLine(JSON.stringify({ f: parsed.filters, ft: parsed.focusType, out: parsed.focusedOutcome })),
      resultSize,
      cacheStatus: "none",
      correlationId,
      payloadBytes: payloadByteSize(payload),
      degradedMode: exportMax < exportMaxRequested,
    });

    const res = NextResponse.json(
      {
        ...payload,
        ...(exportMax < exportMaxRequested || governance.trimmed || runtimeBefore.degraded
          ? { degraded: true as const }
          : {}),
        ciObservability: buildObs({
          serverFacetMs: ms,
          cacheHit: false,
          cacheAgeMs: 0,
          recomputeReason: "cold",
        }),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15",
          "X-Focused-Payload-Bytes": String(governance.bytes),
        },
      }
    );
    res.headers.set("X-Correlation-Id", correlationId);
    if (exportMax < exportMaxRequested || governance.trimmed || runtimeBefore.degraded || budgetDegraded) {
      res.headers.set("X-Degraded", "1");
    }
    res.headers.set("X-Focused-Facet-Budget-Bytes", String(facetBudget.budgetBytes));
    return res;
  } catch (e) {
    const rawMsg = e instanceof Error ? e.message : "Error";
    const isOversize =
      /bson/i.test(rawMsg) || /16\s*mb/i.test(rawMsg) || /document too large/i.test(rawMsg);
    logRouteError({
      path: ROUTE_PATH,
      durationMs: Date.now() - routeT0,
      correlationId,
      cause: inferRouteErrorCause(e, Date.now() - routeT0),
      aggregation: "focused_activity_report",
      message: rawMsg,
    });
    const res = jsonInternalServerError(e, {
      merge: {
        correlationId,
        ok: false,
        degraded: isOversize,
        userMessage:
          "Analytics could not be assembled for this scope. Try narrowing filters or refreshing.",
      },
      fallbackMessage:
        "Analytics could not be assembled for this scope. Try narrowing filters or refreshing.",
    });
    res.headers.set("X-Correlation-Id", correlationId);
    if (isOversize) res.headers.set("X-Degraded", "1");
    return res;
  }
}
