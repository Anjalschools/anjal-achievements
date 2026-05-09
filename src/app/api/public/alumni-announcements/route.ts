import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniAnnouncement from "@/models/AlumniAnnouncement";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
  },
};

export async function GET(request: NextRequest) {
  try {
    const category = String(request.nextUrl.searchParams.get("category") || "").trim();
    await connectDB();
    const now = new Date();
    const filter: Record<string, unknown> = {
      published: true,
      $and: [
        {
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
        },
        {
          $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }],
        },
      ],
    };
    if (category) {
      filter.category = category;
    }

    const rows = await AlumniAnnouncement.find(filter)
      .select("title slug summary category featured pinned publishAt coverImage")
      .sort({ pinned: -1, featured: -1, publishAt: -1 })
      .limit(60)
      .lean();

    return NextResponse.json(
      {
        ok: true,
        items: rows.map((row: any) => ({
          title: row.title || "",
          slug: row.slug || "",
          summary: row.summary || "",
          category: row.category || "",
          featured: row.featured === true,
          pinned: row.pinned === true,
          publishAt: row.publishAt ? new Date(row.publishAt).toISOString() : null,
          coverImage: row.coverImage || null,
        })),
      },
      JSON_HEADERS
    );
  } catch (error) {
    console.error("[GET /api/public/alumni-announcements]", error);
    return NextResponse.json({ ok: true, items: [] }, JSON_HEADERS);
  }
}
