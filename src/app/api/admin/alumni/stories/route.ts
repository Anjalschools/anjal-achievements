import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniStory from "@/models/AlumniStory";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const q = sanitizeUserText(String(request.nextUrl.searchParams.get("q") || ""));
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (q) filter.$text = { $search: q };
    const rows = await AlumniStory.find(filter)
      .select("title slug featured published publishedAt createdAt")
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        title: row.title || "",
        slug: row.slug || "",
        featured: row.featured === true,
        published: row.published === true,
        publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/stories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const title = sanitizeUserText(String(body.title || ""));
    const content = sanitizeUserText(String(body.content || ""));
    const excerpt = sanitizeUserText(String(body.excerpt || ""));
    const slugRaw = sanitizeUserText(String(body.slug || ""));
    const slug = slugify(slugRaw || title);
    if (!title || !slug) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

    await connectDB();
    const exists = await AlumniStory.findOne({ slug }).select("_id").lean();
    if (exists) return NextResponse.json({ error: "SLUG_EXISTS" }, { status: 409 });

    const published = body.published === true;
    const row = await AlumniStory.create({
      title,
      slug,
      excerpt: excerpt || undefined,
      content: content || undefined,
      coverImage: sanitizeUserText(String(body.coverImage || "")) || undefined,
      graduationYear: Number(body.graduationYear) || undefined,
      universityName: sanitizeUserText(String(body.universityName || "")) || undefined,
      currentCompany: sanitizeUserText(String(body.currentCompany || "")) || undefined,
      currentPosition: sanitizeUserText(String(body.currentPosition || "")) || undefined,
      featured: body.featured === true,
      published,
      publishedAt: published ? new Date() : undefined,
      seoTitle: sanitizeUserText(String(body.seoTitle || "")) || undefined,
      seoDescription: sanitizeUserText(String(body.seoDescription || "")) || undefined,
      createdById: gate.user._id,
    });
    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/alumni/stories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
