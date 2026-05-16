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
import { getLatestCompetitionSnapshot } from "@/lib/competition/analytics/historical-metrics";
import type { CompetitionSnapshotPayload } from "@/lib/competition/analytics/snapshot-engine";
import connectDB from "@/lib/mongodb";

export const dynamic = "force-dynamic";

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

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseParticipationFiltersFromSearchParams(searchParams);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get("pageSize") || "25", 10) || 25));
    const bypass = searchParams.get("nocache") === "1";
    const snapshotFallback = searchParams.get("snapshotFallback") === "1";

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
      payload = await buildParticipationAnalytics({ filters, page, pageSize });
    } catch (buildErr) {
      if (snapshotFallback) {
        await connectDB();
        const snap = await getLatestCompetitionSnapshot("daily");
        const sp = snap?.payload as CompetitionSnapshotPayload | undefined;
        if (sp) {
          payload = {
            ok: true,
            generatedAt: sp.computedAt,
            filters,
            kpis: sp.kpis as Awaited<ReturnType<typeof buildParticipationAnalytics>>["kpis"],
            charts: {
              genderParticipation: [],
              sectionParticipation: [],
              mawhibaSplit: [],
              resultDistribution: [],
              levelDistribution: [],
              genderResultStack: [],
              topPrograms: [],
              activityHorizontal: [],
              resultOutcomeCompare: sp.outcomes.map((o) => ({
                key: o.key,
                labelAr: o.key,
                labelEn: o.key,
                count: o.count,
                color: "#94a3b8",
              })),
              yearTrend: sp.growth.yearTrend,
            },
            activityOptions: [],
            focusedActivity: null,
            table: [],
            tableTotal: 0,
            page,
            pageSize,
          };
          obsSource = "snapshot";
          recomputeReason = "snapshot_fallback";
          trustStatus = String(snap?.trustStatus ?? sp.trustStatus);
        } else {
          throw buildErr;
        }
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

    return NextResponse.json(
      {
        ...payload,
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
  } catch (e) {
    console.error("[GET /api/admin/reports/achievement-participation]", e);
    return jsonInternalServerError(e);
  }
}
