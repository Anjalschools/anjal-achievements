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
  type CiObservabilityMeta,
} from "@/lib/competition-intelligence-debug";

export const dynamic = "force-dynamic";

const CACHE_MS = 45_000;
const cache = new Map<string, { at: number; payload: Awaited<ReturnType<typeof buildParticipationAnalytics>> }>();

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
  source: "route-memory",
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
    const filters = parseParticipationFiltersFromSearchParams(searchParams);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get("pageSize") || "25", 10) || 25));
    const bypass = searchParams.get("nocache") === "1";

    const cacheKey = JSON.stringify({ filters, page, pageSize });
    const now = Date.now();
    if (!bypass) {
      const hit = cache.get(cacheKey);
      if (hit && now - hit.at < CACHE_MS) {
        const cacheAgeMs = now - hit.at;
        logCacheIntel({
          scope: "participation_general",
          hit: true,
          ageMs: cacheAgeMs,
          keyChars: cacheKey.length,
          reason: "memory_hit",
        });
        return NextResponse.json(
          {
            ...hit.payload,
            ciObservability: buildObs({
              serverFacetMs: 0,
              cacheHit: true,
              cacheAgeMs,
            }),
          },
          {
            headers: { "Cache-Control": "private, max-age=30" },
          }
        );
      }
    }

    const t0 = Date.now();
    const payload = await buildParticipationAnalytics({ filters, page, pageSize });
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
    cache.set(cacheKey, { at: now, payload });
    if (cache.size > 80) {
      for (const k of cache.keys()) {
        const v = cache.get(k);
        if (v && now - v.at > CACHE_MS) cache.delete(k);
      }
    }

    return NextResponse.json(
      {
        ...payload,
        ciObservability: buildObs({
          serverFacetMs: ms,
          cacheHit: false,
          cacheAgeMs: 0,
          recomputeReason: bypass ? "nocache_bypass" : "cache_miss",
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
