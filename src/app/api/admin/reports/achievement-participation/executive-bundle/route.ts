import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  parseParticipationFiltersFromSearchParams,
} from "@/lib/achievement-participation-analytics";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { createCorrelationId } from "@/lib/competition-intelligence-debug";
import { deserializeAnalyticsFiltersFromUrl } from "@/lib/analytics/report-filter-url-sync";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  resolveExecutiveAnalyticsSnapshot,
  DEFAULT_SNAPSHOT_MAX_AGE_MS,
} from "@/lib/analytics/server/analytics-snapshot-resolver";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const correlationId = request.headers.get("x-correlation-id")?.trim() || createCorrelationId();

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseParticipationFiltersFromSearchParams(searchParams);
    const { filters: executiveFilter } = deserializeAnalyticsFiltersFromUrl("participation", searchParams);
    const execFilter = executiveFilter as ExecutiveFilterSnapshot;
    const bypass = searchParams.get("nocache") === "1";
    const allowStale = searchParams.get("allowStale") !== "0";
    const persist = searchParams.get("persist") !== "0";
    const scope = (searchParams.get("scope") || "full").toLowerCase();

    const resolved = await resolveExecutiveAnalyticsSnapshot({
      filters,
      executiveFilter: execFilter,
      bypassSnapshot: bypass,
      allowStale,
      persist: bypass ? false : persist,
      maxAgeMs: DEFAULT_SNAPSHOT_MAX_AGE_MS,
    });

    const full = resolved.bundle;
    const light = {
      version: full.version,
      aggregationVersion: full.aggregationVersion,
      computedAt: full.computedAt,
      filterFingerprint: full.filterFingerprint,
      kpiStrip: full.kpiStrip,
      trustIssues: full.trustIssues,
    };
    const decisions = {
      ...light,
      narratives: full.narratives,
      strategicInsights: full.strategicInsights,
      aiDecisionBundle: full.aiDecisionBundle ?? null,
    };

    return NextResponse.json(
      {
        ok: true,
        bundle:
          scope === "light" ? light
          : scope === "decisions" ? decisions
          : resolved.bundle,
        aiDecisionBundle:
          scope === "light" ? null
          : scope === "decisions" ? (full.aiDecisionBundle ?? null)
          : (resolved.bundle.aiDecisionBundle ?? null),
        meta: resolved.meta,
        ciObservability: {
          generatedAt: new Date().toISOString(),
          serverFacetMs: resolved.meta.facetMs,
          cacheHit: resolved.meta.source !== "live",
          cacheAgeMs: resolved.meta.ageMs,
          source: resolved.meta.source === "live" ? "none" : "snapshot",
          recomputeReason: resolved.meta.source === "live" ? "cache_miss" : undefined,
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Executive-Snapshot-Source": resolved.meta.source,
          "X-Correlation-Id": correlationId,
          "X-Executive-Scope": scope,
        },
      }
    );
  } catch (e) {
    const res = jsonInternalServerError(e, { merge: { correlationId } });
    res.headers.set("X-Correlation-Id", correlationId);
    return res;
  }
}
