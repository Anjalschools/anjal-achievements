import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import {
  buildParticipationAnalytics,
  parseParticipationFiltersFromSearchParams,
} from "@/lib/achievement-participation-analytics";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

const CACHE_MS = 45_000;
const cache = new Map<string, { at: number; payload: Awaited<ReturnType<typeof buildParticipationAnalytics>> }>();

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
        return NextResponse.json(hit.payload, {
          headers: { "Cache-Control": "private, max-age=30" },
        });
      }
    }

    const payload = await buildParticipationAnalytics({ filters, page, pageSize });
    cache.set(cacheKey, { at: now, payload });
    if (cache.size > 80) {
      for (const k of cache.keys()) {
        const v = cache.get(k);
        if (v && now - v.at > CACHE_MS) cache.delete(k);
      }
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    console.error("[GET /api/admin/reports/achievement-participation]", e);
    return jsonInternalServerError(e);
  }
}
