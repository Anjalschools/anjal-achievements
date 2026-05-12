import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniStory from "@/models/AlumniStory";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";
import { invalidateAlumniSummaryCache } from "@/lib/alumni/alumni-public-cache";
import {
  alumniStoryContentEmptyIssue,
  alumniStoryTitleRequiredIssue,
  type AlumniStoryFieldIssue,
  withStructuredStoryIssues,
} from "@/lib/alumni/alumni-story-field-issues";
import {
  alumniStoryBodyHasVisibleText,
  normalizeAlumniStoryBody,
  stripHtmlNoiseForEmptyCheck,
} from "@/lib/alumni/alumni-story-input";
import { randomSlugCollisionSuffix, slugifyLatin, slugifyWithTransliterationFallback } from "@/lib/alumni/slugify";

export const dynamic = "force-dynamic";

const MAX_SLUG_BASE = 120;

/** Unicode-safe slug: keeps Arabic letters & digits; strips risky chars. */
const slugifyUnicode = (value: string): string => {
  const s = value.normalize("NFKC").trim();
  if (!s) return "";
  return s
    .replace(/\s+/gu, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase()
    .slice(0, MAX_SLUG_BASE);
};

const pickBaseSlug = (title: string, slugRaw: string): string => {
  const fromExplicit = slugifyLatin(slugRaw);
  if (fromExplicit.replace(/-/g, "").length >= 2) return fromExplicit.slice(0, MAX_SLUG_BASE);
  const transliterated = slugifyWithTransliterationFallback(title || slugRaw, MAX_SLUG_BASE);
  if (transliterated.replace(/-/g, "").length >= 2) return transliterated.slice(0, MAX_SLUG_BASE);
  const uni = slugifyUnicode(slugRaw || title);
  if (uni.length >= 2) return uni.slice(0, MAX_SLUG_BASE);
  return "";
};

const allocateUniqueSlug = async (title: string, slugRaw: string): Promise<string> => {
  let base = pickBaseSlug(title, slugRaw);
  if (!base) {
    base = `story-${crypto.randomBytes(5).toString("hex")}`;
  }
  base = base.slice(0, MAX_SLUG_BASE).toLowerCase();
  let candidate = base;
  for (let attempt = 0; attempt < 220; attempt += 1) {
    const exists = await AlumniStory.findOne({ slug: candidate }).select("_id").lean();
    if (!exists) return candidate;
    candidate = `${base.slice(0, Math.max(8, MAX_SLUG_BASE - 12))}-${randomSlugCollisionSuffix()}`.toLowerCase();
  }
  return `story-${crypto.randomBytes(6).toString("hex")}`.toLowerCase();
};

const flattenMongooseValidation = (err: mongoose.Error.ValidationError) => {
  const fieldErrors: Record<string, AlumniStoryFieldIssue> = {};
  for (const [path, detail] of Object.entries(err.errors)) {
    const m = detail?.message || "invalid";
    fieldErrors[path] = {
      ar: `الحقل "${path}": ${m}`,
      en: `${path}: ${m}`,
    };
  }
  return withStructuredStoryIssues(fieldErrors);
};

export async function GET(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
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
      items: rows.map((row: { _id: unknown; title?: string; slug?: string; featured?: boolean; published?: boolean; publishedAt?: Date; createdAt?: Date }) => ({
        id: String(row._id),
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
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const body = sanitizeMongoShape(rawBody);
    const titleNorm = normalizeAlumniStoryBody(stripHtmlNoiseForEmptyCheck(String(body.title ?? "")));
    const title = sanitizeUserText(titleNorm).slice(0, 220);
    const contentNorm = normalizeAlumniStoryBody(stripHtmlNoiseForEmptyCheck(String(body.content ?? "")));
    const content = sanitizeUserText(contentNorm).slice(0, 30_000);
    const excerpt = sanitizeUserText(normalizeAlumniStoryBody(String(body.excerpt ?? ""))).slice(0, 600);
    const slugRaw = sanitizeUserText(String(body.slug ?? "")).trim();

    alumniDebugLog("alumni-story-payload", {
      titleLen: title.length,
      hasContent: alumniStoryBodyHasVisibleText(contentNorm),
      excerptLen: excerpt.length,
      slugLen: slugRaw.length,
      published: body.published === true,
    });

    if (!title || title.length < 2) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "INVALID_INPUT",
          issues: alumniStoryTitleRequiredIssue,
        },
        { status: 400 }
      );
    }

    if (!alumniStoryBodyHasVisibleText(contentNorm)) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "INVALID_INPUT",
          issues: alumniStoryContentEmptyIssue,
        },
        { status: 400 }
      );
    }

    await connectDB();
    const slug = await allocateUniqueSlug(title, slugRaw);

    const published = body.published === true;
    const gy = body.graduationYear;
    const graduationYear =
      typeof gy === "number" && Number.isFinite(gy)
        ? Math.round(gy)
        : gy != null && String(gy).trim() !== ""
          ? Math.round(Number(String(gy)))
          : undefined;

    const row = await AlumniStory.create({
      title,
      slug,
      excerpt: excerpt || undefined,
      content: content || undefined,
      coverImage: sanitizeUserText(String(body.coverImage || "")) || undefined,
      graduationYear:
        graduationYear !== undefined && graduationYear >= 1950 && graduationYear <= 2100 ? graduationYear : undefined,
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
    invalidateAlumniSummaryCache("admin:alumni-story:create");
    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      alumniDebugLog("alumni-story-validation", flattenMongooseValidation(error));
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: "INVALID_INPUT",
          issues: flattenMongooseValidation(error),
        },
        { status: 400 }
      );
    }
    console.error("[POST /api/admin/alumni/stories]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
