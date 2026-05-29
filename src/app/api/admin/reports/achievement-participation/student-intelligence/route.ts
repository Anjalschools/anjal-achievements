import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { parseParticipationFiltersFromSearchParams } from "@/lib/achievement-participation-analytics";
import { buildStudentIntelligence } from "@/lib/student-intelligence-analytics";
import { slimStudentIntelligenceLitePayload } from "@/lib/analytics/runtime/slim-student-intel-payload";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { ciRedactLine, logAggregationHealth, type CiObservabilityMeta } from "@/lib/competition-intelligence-debug";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { CiRouteMemoryCache } from "@/lib/competition/cache/cache-lifecycle";

export const dynamic = "force-dynamic";

const studentIntelCache = new CiRouteMemoryCache<
  Awaited<ReturnType<typeof buildStudentIntelligence>>
>({ softTtlMs: 60_000, staleTtlMs: 180_000, maxEntries: 48 });

const buildObs = (p: {
  serverFacetMs: number;
  cacheHit: boolean;
  cacheAgeMs: number;
  recomputeReason?: CiObservabilityMeta["recomputeReason"];
  cacheLifecycle?: CiObservabilityMeta["cacheLifecycle"];
}): CiObservabilityMeta => ({
  generatedAt: new Date().toISOString(),
  serverFacetMs: p.serverFacetMs,
  cacheHit: p.cacheHit,
  cacheAgeMs: p.cacheAgeMs,
  source: "route-memory",
  recomputeReason: p.recomputeReason,
  aggregationVersion: CI_AGGREGATION_VERSION,
  cacheLifecycle: p.cacheLifecycle,
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
    const lite = searchParams.get("intelScope") === "lite";
    const bypass = searchParams.get("nocache") === "1";
    const cacheKey = JSON.stringify({ filters, lite });

    if (!bypass) {
      const resolved = studentIntelCache.get(cacheKey);
      if (resolved.hit && resolved.payload) {
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
    const raw = await buildStudentIntelligence(filters, { lite });
    const payload = lite ? slimStudentIntelligenceLitePayload(raw) : raw;
    const ms = Date.now() - t0;
    studentIntelCache.set(cacheKey, payload);

    logAggregationHealth({
      facet: lite ? "student_intelligence_lite" : "student_intelligence",
      durationMs: ms,
      filterSummary: ciRedactLine(JSON.stringify(filters)),
      resultSize:
        payload.byParticipation.length +
        payload.byMedals.length +
        payload.byFastestGrowth.length,
      cacheStatus: bypass ? "none" : "miss",
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
        headers: { "Cache-Control": "private, max-age=20" },
      }
    );
  } catch (e) {
    console.error("[GET /api/admin/reports/achievement-participation/student-intelligence]", e);
    return jsonInternalServerError(e);
  }
}
