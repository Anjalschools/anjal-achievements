import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { parseSearchRequest } from "@/lib/search/search-params";
import { searchMentors } from "@/lib/search/global-search";
import { semanticSearchOverlay } from "@/lib/search/semantic/semantic-search";
import { logUnifiedSearchRequest } from "@/lib/search/search-api-debug";
import { requireAlumniCommunityAccess } from "@/lib/alumni/require-alumni-community-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await requireAlumniCommunityAccess();
  if (!access.ok) return access.response;
  try {
    await connectDB();
    const { nq, pag } = parseSearchRequest(request.nextUrl.searchParams);
    const verifiedOnly = request.nextUrl.searchParams.get("verified") === "1";
    const { items, totalEstimate } = await searchMentors(nq, pag, { verifiedOnly });
    const itemsOut = await semanticSearchOverlay(nq, items);
    logUnifiedSearchRequest("mentors", nq, pag, {
      resultCount: itemsOut.length,
      totalEstimate,
      verifiedOnly,
    });
    return NextResponse.json({ ok: true, data: { items: itemsOut, totalEstimate } });
  } catch (e) {
    console.error("[GET /api/search/mentors]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
