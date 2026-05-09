import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniAnnouncement from "@/models/AlumniAnnouncement";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await connectDB();
    const now = new Date();
    const row = await AlumniAnnouncement.findOne({
      slug: String(slug || "").toLowerCase(),
      published: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select(
        "title slug summary content category targetCohorts targetUniversities targetIndustries coverImage featured pinned publishAt expiresAt"
      )
      .lean();

    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      item: {
        title: (row as any).title || "",
        slug: (row as any).slug || "",
        summary: (row as any).summary || "",
        content: (row as any).content || "",
        category: (row as any).category || "",
        targetCohorts: (row as any).targetCohorts || [],
        targetUniversities: (row as any).targetUniversities || [],
        targetIndustries: (row as any).targetIndustries || [],
        coverImage: (row as any).coverImage || null,
        featured: (row as any).featured === true,
        pinned: (row as any).pinned === true,
        publishAt: (row as any).publishAt ? new Date((row as any).publishAt).toISOString() : null,
        expiresAt: (row as any).expiresAt ? new Date((row as any).expiresAt).toISOString() : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-announcement/[slug]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
