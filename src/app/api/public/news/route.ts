import { NextRequest, NextResponse } from "next/server";
import { listPublishedNews } from "@/lib/public-news-queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(sp.get("limit") || "12", 10) || 12));
    const { total, items } = await listPublishedNews(page, limit);
    return NextResponse.json({ ok: true, items, total, page, limit });
  } catch (e) {
    console.error("[GET /api/public/news]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
