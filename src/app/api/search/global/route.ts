import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { parseSearchRequest } from "@/lib/search/search-params";
import { searchGlobal } from "@/lib/search/global-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { nq, pag } = parseSearchRequest(request.nextUrl.searchParams);
    const data = await searchGlobal(nq, pag);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/search/global]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
