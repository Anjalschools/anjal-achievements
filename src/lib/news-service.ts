import mongoose from "mongoose";
import NewsPost from "@/models/NewsPost";
import { slugifyTitle } from "@/lib/news-slug";

export const draftSlugForId = (id: string): string => `draft-${id}`;

export const ensurePublicSlug = async (newsId: mongoose.Types.ObjectId, title: string): Promise<string> => {
  const base = slugifyTitle(title);
  let slug = base;
  let n = 0;
  while (true) {
    const exists = await NewsPost.findOne({
      slug,
      _id: { $ne: newsId },
    })
      .select("_id")
      .lean();
    if (!exists) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
};
