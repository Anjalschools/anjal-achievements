import { NextRequest, NextResponse } from "next/server";
import { getPublishedNewsBySlug } from "@/lib/public-news-queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await ctx.params;
    const data = await getPublishedNewsBySlug(slug);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item: data.detail, related: data.related });
  } catch (e) {
    console.error("[GET /api/public/news/[slug]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
