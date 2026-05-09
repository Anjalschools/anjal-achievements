import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { slugifyLatin } from "@/lib/alumni/slugify";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    await connectDB();
    const rows = await AlumniReunionEvent.find({})
      .select("title slug published featured startsAt eventType cohortYear rsvpCount updatedAt")
      .sort({ updatedAt: -1 })
      .limit(120)
      .lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        title: row.title || "",
        slug: row.slug || "",
        published: row.published === true,
        featured: row.featured === true,
        startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
        eventType: row.eventType || "",
        cohortYear: row.cohortYear ?? null,
        rsvpCount: Number(row.rsvpCount || 0),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/events]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const title = sanitizeUserText(String(body.title || ""));
    const slug = slugifyLatin(sanitizeUserText(String(body.slug || title)));
    const eventType = String(body.eventType || "cohort");
    if (!title || !slug) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (!["in_person", "online", "school", "cohort"].includes(eventType)) {
      return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    }

    await connectDB();
    const exists = await AlumniReunionEvent.findOne({ slug }).select("_id").lean();
    if (exists) return NextResponse.json({ error: "SLUG_EXISTS" }, { status: 409 });

    const startsAt = body.startsAt ? new Date(String(body.startsAt)) : new Date();
    const row = await AlumniReunionEvent.create({
      title,
      slug,
      summary: sanitizeUserText(String(body.summary || "")) || undefined,
      content: sanitizeUserText(String(body.content || "")) || undefined,
      eventType,
      cohortYear: Number(body.cohortYear) || undefined,
      location: sanitizeUserText(String(body.location || "")) || undefined,
      meetingLink: sanitizeUserText(String(body.meetingLink || "")) || undefined,
      startsAt,
      endsAt: body.endsAt ? new Date(String(body.endsAt)) : undefined,
      coverImage: sanitizeUserText(String(body.coverImage || "")) || undefined,
      published: body.published === true,
      featured: body.featured === true,
      publishAt: body.publishAt ? new Date(String(body.publishAt)) : undefined,
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined,
      createdById: gate.user._id,
    });

    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/alumni/events]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
