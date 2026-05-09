import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { parseSearchRequest } from "@/lib/search/search-params";
import { searchOpportunities } from "@/lib/search/global-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { nq, pag } = parseSearchRequest(request.nextUrl.searchParams);
    const data = await searchOpportunities(nq, pag);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/search/opportunities]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
