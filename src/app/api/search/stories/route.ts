import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { parseSearchRequest } from "@/lib/search/search-params";
import { searchStories } from "@/lib/search/global-search";
import { logUnifiedSearchRequest } from "@/lib/search/search-api-debug";
import { requireAlumniCommunityAccess } from "@/lib/alumni/require-alumni-community-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireAlumniCommunityAccess();
  if (!access.ok) return access.response;
  try {
    await connectDB();
    const { nq, pag } = parseSearchRequest(request.nextUrl.searchParams);
    const data = await searchStories(nq, pag);
    logUnifiedSearchRequest("stories", nq, pag, { resultCount: data.items.length, totalEstimate: data.totalEstimate });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/search/stories]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
