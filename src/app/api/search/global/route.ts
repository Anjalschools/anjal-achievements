import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { parseSearchRequest } from "@/lib/search/search-params";
import { searchGlobal } from "@/lib/search/global-search";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";
import { requireAlumniCommunityAccess } from "@/lib/alumni/require-alumni-community-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireAlumniCommunityAccess();
  if (!access.ok) return access.response;
  try {
    await connectDB();
    const { nq, pag } = parseSearchRequest(request.nextUrl.searchParams);
    const t0 = Date.now();
    const data = await searchGlobal(nq, pag);
    alumniDebugLog("search-api:global", {
      page: pag.page,
      pageSize: pag.pageSize,
      tokenCount: nq.tokens.length,
      rawLen: nq.raw.length,
      alumni: data.alumni.length,
      mentors: data.mentors.length,
      opportunities: data.opportunities.length,
      events: data.events.length,
      stories: data.stories.length,
      cohorts: data.cohorts.length,
      totals: data.totals,
      latencyMs: Date.now() - t0,
    });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/search/global]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
