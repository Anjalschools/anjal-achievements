import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  buildParticipationAnalytics,
  parseParticipationFiltersFromSearchParams,
} from "@/lib/achievement-participation-analytics";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  ciRedactLine,
  logAggregationHealth,
  logCacheIntel,
  logCacheRegenerationIntel,
  logStaleDatasetIntel,
  type CiObservabilityMeta,
} from "@/lib/competition-intelligence-debug";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { CiRouteMemoryCache } from "@/lib/competition/cache/cache-lifecycle";
import { createCorrelationId } from "@/lib/competition-intelligence-debug";
import { buildParticipationSnapshotFallback } from "@/lib/resilience/participation-snapshot-fallback";
import { DEFAULT_AGGREGATION_TIMEOUT_MS, withTimeout } from "@/lib/resilience/query-safety";
import { inferRouteErrorCause, logRouteError, payloadByteSize } from "@/lib/resilience/route-error-log";

export const dynamic = "force-dynamic";
const ROUTE_PATH = "/api/admin/reports/achievement-participation";

const participationCache = new CiRouteMemoryCache<
  Awaited<ReturnType<typeof buildParticipationAnalytics>>
>();

const buildObs = (p: {
  serverFacetMs: number;
  cacheHit: boolean;
  cacheAgeMs: number;
  recomputeReason?: CiObservabilityMeta["recomputeReason"];
  cacheLifecycle?: CiObservabilityMeta["cacheLifecycle"];
  source?: CiObservabilityMeta["source"];
  trustStatus?: string;
}): CiObservabilityMeta => ({
  generatedAt: new Date().toISOString(),
  serverFacetMs: p.serverFacetMs,
  cacheHit: p.cacheHit,
  cacheAgeMs: p.cacheAgeMs,
  source: p.source ?? "route-memory",
  recomputeReason: p.recomputeReason,
  aggregationVersion: CI_AGGREGATION_VERSION,
  cacheLifecycle: p.cacheLifecycle,
  trustStatus: p.trustStatus,
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
    const filters = parseParticipationFiltersFromSearchParams(searchParams);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get("pageSize") || "25", 10) || 25));
    const bypass = searchParams.get("nocache") === "1";
    const cacheKey = JSON.stringify({ filters, page, pageSize });

    if (!bypass) {
      const resolved = participationCache.get(cacheKey);
      if (resolved.hit && resolved.payload) {
        logCacheIntel({
          scope: "participation_general",
          hit: true,
          ageMs: resolved.ageMs,
          keyChars: cacheKey.length,
          reason: resolved.status,
        });
        if (resolved.status === "stale") {
          logStaleDatasetIntel({
            scope: "participation_general",
            ageMs: resolved.ageMs,
            thresholdMs: 45_000,
          });
        }
        return NextResponse.json(
          {
            ...resolved.payload,
            ciObservability: buildObs({
              serverFacetMs: 0,
              cacheHit: true,
              cacheAgeMs: resolved.ageMs,
              cacheLifecycle: resolved.status,
              recomputeReason: resolved.shouldRevalidate ? "stale_revalidate" : undefined,
            }),
          },
          {
            headers: {
              "Cache-Control": "private, max-age=30",
              "X-CI-Cache-Lifecycle": resolved.status,
            },
          }
        );
      }
    }

    const t0 = Date.now();
    let payload: Awaited<ReturnType<typeof buildParticipationAnalytics>>;
    let obsSource: CiObservabilityMeta["source"] = "none";
    let recomputeReason: CiObservabilityMeta["recomputeReason"] = bypass ? "nocache_bypass" : "cache_miss";
    let trustStatus: string | undefined;

    try {
      payload = await withTimeout("participation_general", DEFAULT_AGGREGATION_TIMEOUT_MS, async () =>
        buildParticipationAnalytics({ filters, page, pageSize })
      );
    } catch (buildErr) {
      const fb = await buildParticipationSnapshotFallback({ filters, page, pageSize });
      if (fb) {
        payload = fb;
        obsSource = "snapshot";
        recomputeReason = "snapshot_fallback";
        trustStatus = "degraded";
      } else {
        throw buildErr;
      }
    }

    const ms = Date.now() - t0;
    logAggregationHealth({
      facet: "participation_general",
      durationMs: ms,
      filterSummary: ciRedactLine(cacheKey),
      resultSize: payload.tableTotal,
      cacheStatus: bypass ? "none" : "miss",
      correlationId,
      degradedMode: obsSource === "snapshot",
      payloadBytes: payloadByteSize(payload),
    });
    logCacheIntel({
      scope: "participation_general",
      hit: false,
      keyChars: cacheKey.length,
      reason: bypass ? "nocache_bypass" : "recomputed",
    });
    logCacheRegenerationIntel({
      scope: "participation_general",
      durationMs: ms,
      reason: recomputeReason ?? "recomputed",
    });

    if (!bypass && obsSource !== "snapshot") {
      participationCache.set(cacheKey, payload, "synced");
    }

    const res = NextResponse.json(
      {
        ...payload,
        ...(obsSource === "snapshot" ? { degraded: true as const } : {}),
        ciObservability: buildObs({
          serverFacetMs: ms,
          cacheHit: false,
          cacheAgeMs: 0,
          recomputeReason,
          source: obsSource,
          trustStatus,
        }),
      },
      {
        headers: { "Cache-Control": "private, max-age=30" },
      }
    );
    if (obsSource === "snapshot") res.headers.set("X-Degraded", "1");
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  } catch (e) {
    const durationMs = Date.now() - routeT0;
    logRouteError({
      path: ROUTE_PATH,
      durationMs,
      correlationId,
      cause: inferRouteErrorCause(e, durationMs),
      aggregation: "participation_general",
      message: e instanceof Error ? e.message : "Error",
    });
    try {
      const { searchParams } = new URL(request.url);
      const filters = parseParticipationFiltersFromSearchParams(searchParams);
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get("pageSize") || "25", 10) || 25));
      const fb = await buildParticipationSnapshotFallback({ filters, page, pageSize });
      if (fb) {
        const res = NextResponse.json({
          ...fb,
          degraded: true,
          ciObservability: buildObs({
            serverFacetMs: durationMs,
            cacheHit: false,
            cacheAgeMs: 0,
            recomputeReason: "snapshot_fallback",
            source: "snapshot",
            trustStatus: "degraded",
          }),
        });
        res.headers.set("X-Degraded", "1");
        res.headers.set("X-Correlation-Id", correlationId);
        return res;
      }
    } catch {
      /* ignore fallback failure */
    }
    const res = jsonInternalServerError(e, { merge: { correlationId } });
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  }
}
