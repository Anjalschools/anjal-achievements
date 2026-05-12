import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { isAllowedAlumniMemoryImageUrl } from "@/lib/alumni/alumni-memory-url";
import type { PublicAlumniMemoryShowcaseItem } from "@/lib/alumni/alumni-public-types";

const privacySearchable = (): Record<string, unknown> => ({
  $nor: [{ "alumniProfile.privacySettings.searchable": false }],
});

type AggRow = {
  _id: mongoose.Types.ObjectId;
  fullName?: string;
  profilePhoto?: string | null;
  graduationYear?: number | null;
  postId: mongoose.Types.ObjectId;
  imageUrl?: string;
  caption?: string;
  memoryYear?: number | null;
  submittedAt?: Date | null;
  likeCount?: number;
  viewCount?: number;
  featuredScore?: number;
};

/**
 * Approved alumni memory posts for public landing (privacy-respecting, URL allowlist).
 * Sort: engagement highlight → likes → recency.
 */
export const listPublicAlumniMemoriesShowcase = async (limit = 8): Promise<PublicAlumniMemoryShowcaseItem[]> => {
  await connectDB();
  const cap = Math.min(24, Math.max(limit, 1) * 4);

  const rows = await User.aggregate<AggRow>([
    {
      $match: {
        accountType: "alumni",
        ...alumniCommunityActiveUserClause(),
        ...privacySearchable(),
        "alumniProfile.memoryPosts": { $exists: true, $ne: [] },
      },
    },
    { $unwind: "$alumniProfile.memoryPosts" },
    {
      $match: {
        "alumniProfile.memoryPosts.status": "approved",
        "alumniProfile.memoryPosts.imageUrl": { $regex: String.raw`^https://` },
      },
    },
    {
      $addFields: {
        _like: { $ifNull: ["$alumniProfile.memoryPosts.likeCount", 0] },
        _views: { $ifNull: ["$alumniProfile.memoryPosts.viewCount", 0] },
        _sub: "$alumniProfile.memoryPosts.submittedAt",
        _featuredScore: {
          $add: [
            { $cond: [{ $eq: ["$alumniProfile.isFeaturedAlumni", true] }, 4, 0] },
            { $cond: [{ $eq: ["$alumniProfile.isDistinguishedAlumni", true] }, 2, 0] },
            { $cond: [{ $gte: [{ $ifNull: ["$alumniProfile.memoryPosts.likeCount", 0] }, 15] }, 2, 0] },
            { $cond: [{ $gte: [{ $ifNull: ["$alumniProfile.memoryPosts.viewCount", 0] }, 80] }, 1, 0] },
          ],
        },
      },
    },
    { $sort: { _featuredScore: -1, _like: -1, _sub: -1 } },
    { $limit: cap },
    {
      $project: {
        _id: 1,
        fullName: { $ifNull: ["$fullNameAr", { $ifNull: ["$fullNameEn", "$fullName"] }] },
        profilePhoto: 1,
        graduationYear: "$alumniProfile.graduationYear",
        postId: "$alumniProfile.memoryPosts._id",
        imageUrl: "$alumniProfile.memoryPosts.imageUrl",
        caption: "$alumniProfile.memoryPosts.caption",
        memoryYear: "$alumniProfile.memoryPosts.memoryYear",
        submittedAt: "$alumniProfile.memoryPosts.submittedAt",
        likeCount: "$_like",
        viewCount: "$_views",
        featuredScore: "$_featuredScore",
      },
    },
  ]);

  const out: PublicAlumniMemoryShowcaseItem[] = [];
  for (const r of rows) {
    const imageUrl = String(r.imageUrl || "").trim();
    if (!isAllowedAlumniMemoryImageUrl(imageUrl)) continue;
    const gy =
      typeof r.graduationYear === "number" && Number.isFinite(r.graduationYear)
        ? Math.trunc(r.graduationYear)
        : null;
    const my =
      typeof r.memoryYear === "number" && Number.isFinite(r.memoryYear) ? Math.trunc(r.memoryYear) : null;
    const score = Number(r.featuredScore || 0);
    out.push({
      ownerUserId: r._id.toString(),
      memoryPostId: r.postId.toString(),
      fullName: String(r.fullName || "").trim() || "—",
      profilePhoto: r.profilePhoto ? String(r.profilePhoto) : null,
      imageUrl,
      caption: String(r.caption || "").trim(),
      graduationYear: gy,
      memoryYear: my,
      likeCount: Math.max(0, Number(r.likeCount || 0)),
      viewCount: Math.max(0, Number(r.viewCount || 0)),
      isHighlighted: score >= 4,
    });
    if (out.length >= limit) break;
  }
  return out;
};
