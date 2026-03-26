import connectDB from "@/lib/mongodb";
import NewsPost from "@/models/NewsPost";
import { toPublicNewsDetail, toPublicNewsListItem } from "@/lib/public-news";

const publishedSlugFilter = { $regex: /^(?!draft-)/ };

export const listPublishedNews = async (page: number, limit: number) => {
  await connectDB();
  const skip = (page - 1) * limit;
  const q = { status: "published" as const, slug: publishedSlugFilter };
  const total = await NewsPost.countDocuments(q);
  const rows = await NewsPost.find(q)
    .sort({ publishedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("slug title subtitle summary coverImage publishedAt category locale")
    .lean();
  return {
    total,
    items: rows.map((r) => toPublicNewsListItem(r as unknown as Record<string, unknown>)),
  };
};

export const getPublishedNewsBySlug = async (slug: string) => {
  const s = String(slug || "").trim().toLowerCase();
  if (!s || s.startsWith("draft-")) return null;
  await connectDB();
  const doc = await NewsPost.findOne({
    slug: s,
    status: "published",
  })
    .select(
      "slug title subtitle summary websiteBody coverImage hashtags eventDate location publishedAt category locale"
    )
    .lean();
  if (!doc) return null;
  const detail = toPublicNewsDetail(doc as unknown as Record<string, unknown>);

  const related = await NewsPost.find({
    status: "published",
    slug: { $ne: s },
    ...(detail.category ? { category: detail.category } : {}),
  })
    .sort({ publishedAt: -1 })
    .limit(4)
    .select("slug title subtitle summary coverImage publishedAt category locale")
    .lean();

  let relatedItems = related.map((r) => toPublicNewsListItem(r as unknown as Record<string, unknown>));
  if (relatedItems.length === 0) {
    const fallback = await NewsPost.find({ status: "published", slug: { $ne: s } })
      .sort({ publishedAt: -1 })
      .limit(4)
      .select("slug title subtitle summary coverImage publishedAt category locale")
      .lean();
    relatedItems = fallback.map((r) => toPublicNewsListItem(r as unknown as Record<string, unknown>));
  }

  return { detail, related: relatedItems };
};
