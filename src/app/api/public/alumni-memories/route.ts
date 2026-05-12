import { NextRequest, NextResponse } from "next/server";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";
import { listPublicAlumniMemoriesShowcase } from "@/lib/alumni/public-memories";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
  },
};

export async function GET(request: NextRequest) {
  try {
    const blocked = await blockIneligibleStudentOnPublicCommunityApi();
    if (blocked) return blocked;

    const sp = request.nextUrl.searchParams;
    const limit = Math.min(12, Math.max(4, parseInt(sp.get("limit") || "8", 10) || 8));

    const items = await listPublicAlumniMemoriesShowcase(limit);
    return NextResponse.json({ ok: true as const, items }, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/alumni-memories]", error);
    return NextResponse.json({ ok: true as const, items: [] }, JSON_HEADERS);
  }
}
