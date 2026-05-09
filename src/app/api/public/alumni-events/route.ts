import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
  },
};

export async function GET() {
  try {
    await connectDB();
    const now = new Date();
    const rows = await AlumniReunionEvent.find({
      published: true,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select("title slug summary eventType cohortYear startsAt location featured rsvpCount coverImage")
      .sort({ featured: -1, startsAt: 1 })
      .limit(80)
      .lean();

    return NextResponse.json(
      {
        ok: true,
        items: rows.map((row: any) => ({
          id: row._id.toString(),
          title: row.title || "",
          slug: row.slug || "",
          summary: row.summary || "",
          eventType: row.eventType || "cohort",
          cohortYear: row.cohortYear ?? null,
          startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
          location: row.location || "",
          featured: row.featured === true,
          rsvpCount: Number(row.rsvpCount || 0),
          coverImage: row.coverImage || null,
        })),
      },
      JSON_HEADERS
    );
  } catch (error) {
    console.error("[GET /api/public/alumni-events]", error);
    return NextResponse.json({ ok: true, items: [] }, JSON_HEADERS);
  }
}
