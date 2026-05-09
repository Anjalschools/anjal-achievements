import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniAnnouncement from "@/models/AlumniAnnouncement";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { slugifyLatin } from "@/lib/alumni/slugify";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const q = sanitizeUserText(String(request.nextUrl.searchParams.get("q") || ""));
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (q) filter.title = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const rows = await AlumniAnnouncement.find(filter)
      .select("title slug category published featured pinned publishAt expiresAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(120)
      .lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        title: row.title || "",
        slug: row.slug || "",
        category: row.category || "",
        published: row.published === true,
        featured: row.featured === true,
        pinned: row.pinned === true,
        publishAt: row.publishAt ? new Date(row.publishAt).toISOString() : null,
        expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/announcements]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const title = sanitizeUserText(String(body.title || ""));
    const slugRaw = sanitizeUserText(String(body.slug || ""));
    const slug = slugifyLatin(slugRaw || title);
    const category = sanitizeUserText(String(body.category || "general"));
    if (!title || !slug) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    await connectDB();
    const exists = await AlumniAnnouncement.findOne({ slug }).select("_id").lean();
    if (exists) return NextResponse.json({ error: "SLUG_EXISTS" }, { status: 409 });

    const published = body.published === true;
    const publishAt =
      body.publishAt && String(body.publishAt)
        ? new Date(String(body.publishAt))
        : published
          ? new Date()
          : undefined;

    const row = await AlumniAnnouncement.create({
      title,
      slug,
      summary: sanitizeUserText(String(body.summary || "")) || undefined,
      content: sanitizeUserText(String(body.content || "")) || undefined,
      category,
      targetCohorts: Array.isArray(body.targetCohorts)
        ? (body.targetCohorts as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [],
      targetUniversities: Array.isArray(body.targetUniversities)
        ? (body.targetUniversities as string[]).map((s) => sanitizeUserText(String(s))).filter(Boolean)
        : [],
      targetIndustries: Array.isArray(body.targetIndustries)
        ? (body.targetIndustries as string[]).map((s) => sanitizeUserText(String(s))).filter(Boolean)
        : [],
      coverImage: sanitizeUserText(String(body.coverImage || "")) || undefined,
      published,
      featured: body.featured === true,
      pinned: body.pinned === true,
      publishAt,
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined,
      createdById: gate.user._id,
    });

    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/alumni/announcements]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
