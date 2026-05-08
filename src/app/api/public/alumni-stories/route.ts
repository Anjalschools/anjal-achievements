import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniStory from "@/models/AlumniStory";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
  },
};

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(sp.get("limit") || "9", 10) || 9));
    const featuredOnly = sp.get("featured") === "1";
    const skip = (page - 1) * limit;

    await connectDB();

    const filter: Record<string, unknown> = { published: true };
    if (featuredOnly) filter.featured = true;

    const [rows, total] = await Promise.all([
      AlumniStory.find(filter)
        .select(
          "title slug excerpt coverImage graduationYear universityName currentCompany currentPosition featured publishedAt createdAt"
        )
        .sort({ featured: -1, publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AlumniStory.countDocuments(filter),
    ]);

    const items = rows.map((row: any) => ({
      id: row._id.toString(),
      title: row.title || "",
      slug: row.slug || "",
      excerpt: row.excerpt || null,
      coverImage: row.coverImage || null,
      graduationYear: row.graduationYear ?? null,
      universityName: row.universityName || null,
      currentCompany: row.currentCompany || null,
      currentPosition: row.currentPosition || null,
      featured: row.featured === true,
      publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    }));
    return NextResponse.json({ ok: true, items, total, page, limit }, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/alumni-stories]", error);
    return NextResponse.json({ ok: true, items: [], total: 0, page: 1, limit: 9 }, JSON_HEADERS);
  }
}
