import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniStory from "@/models/AlumniStory";

type RouteParams = { params: { slug: string } };

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const slug = String(params.slug || "").trim().toLowerCase();
    if (!slug) return NextResponse.json({ error: "INVALID_SLUG" }, { status: 400 });

    await connectDB();
    const row = await AlumniStory.findOne({ slug, published: true })
      .select(
        "title slug excerpt content coverImage relatedUserId graduationYear universityName currentCompany currentPosition featured publishedAt seoTitle seoDescription"
      )
      .lean();

    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      item: {
        id: (row as any)._id.toString(),
        title: (row as any).title || "",
        slug: (row as any).slug || "",
        excerpt: (row as any).excerpt || null,
        content: (row as any).content || null,
        coverImage: (row as any).coverImage || null,
        relatedUserId: (row as any).relatedUserId ? String((row as any).relatedUserId) : null,
        graduationYear: (row as any).graduationYear ?? null,
        universityName: (row as any).universityName || null,
        currentCompany: (row as any).currentCompany || null,
        currentPosition: (row as any).currentPosition || null,
        featured: (row as any).featured === true,
        publishedAt: (row as any).publishedAt ? new Date((row as any).publishedAt).toISOString() : null,
        seoTitle: (row as any).seoTitle || null,
        seoDescription: (row as any).seoDescription || null,
      },
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-story/[slug]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
