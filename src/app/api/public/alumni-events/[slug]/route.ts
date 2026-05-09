import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await connectDB();
    const now = new Date();
    const row = await AlumniReunionEvent.findOne({
      slug: String(slug || "").toLowerCase(),
      published: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select(
        "title slug summary content eventType cohortYear location meetingLink startsAt endsAt coverImage featured rsvpCount"
      )
      .lean();

    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      item: {
        id: (row as any)._id.toString(),
        title: (row as any).title || "",
        slug: (row as any).slug || "",
        summary: (row as any).summary || "",
        content: (row as any).content || "",
        eventType: (row as any).eventType || "cohort",
        cohortYear: (row as any).cohortYear ?? null,
        location: (row as any).location || "",
        meetingLink: (row as any).meetingLink || "",
        startsAt: (row as any).startsAt ? new Date((row as any).startsAt).toISOString() : null,
        endsAt: (row as any).endsAt ? new Date((row as any).endsAt).toISOString() : null,
        coverImage: (row as any).coverImage || null,
        featured: (row as any).featured === true,
        rsvpCount: Number((row as any).rsvpCount || 0),
      },
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-events/[slug]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
