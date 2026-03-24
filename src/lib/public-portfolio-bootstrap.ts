import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import {
  ensureUniquePublicPortfolioSlug,
  generatePublicPortfolioSlugBase,
  generatePublicPortfolioToken,
} from "@/lib/public-portfolio";

/**
 * Ensures a student has a public portfolio ready: enabled by default, slug + token allocated.
 * Does not run audit logs (read-time / bootstrap only).
 *
 * Skips when the student was explicitly disabled by an admin after the portfolio had a slug
 * (`publicPortfolioEnabled === false` and `publicPortfolioSlug` is set).
 * Legacy rows with `enabled === false` and no slug are treated as unmigrated and bootstrapped.
 */
export const ensureStudentPublicPortfolioReady = async (userId: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  await connectDB();

  const u = await User.findById(userId)
    .select(
      "+publicPortfolioToken role publicPortfolioEnabled publicPortfolioSlug publicPortfolioToken publicPortfolioPublishedAt fullName fullNameAr fullNameEn"
    )
    .lean();
  if (!u) return;
  if (String((u as { role?: string }).role) !== "student") return;

  const r = u as unknown as Record<string, unknown>;
  const slug =
    typeof r.publicPortfolioSlug === "string" ? r.publicPortfolioSlug.trim().toLowerCase() : "";
  const token =
    typeof r.publicPortfolioToken === "string" ? r.publicPortfolioToken.trim() : "";
  const pe = r.publicPortfolioEnabled;

  const adminExplicitlyDisabled = pe === false && (Boolean(slug) || Boolean(token));
  if (adminExplicitlyDisabled) {
    return;
  }

  const $set: Record<string, unknown> = {};
  if (pe !== true) {
    $set.publicPortfolioEnabled = true;
  }
  if (!slug) {
    $set.publicPortfolioSlug = await ensureUniquePublicPortfolioSlug(
      generatePublicPortfolioSlugBase({
        fullNameEn: typeof r.fullNameEn === "string" ? r.fullNameEn : undefined,
        fullNameAr: typeof r.fullNameAr === "string" ? r.fullNameAr : undefined,
        fullName: typeof r.fullName === "string" ? r.fullName : undefined,
      }),
      userId
    );
  }
  if (!token) {
    $set.publicPortfolioToken = generatePublicPortfolioToken();
  }
  if (!(r.publicPortfolioPublishedAt instanceof Date)) {
    $set.publicPortfolioPublishedAt = new Date();
  }

  if (Object.keys($set).length > 0) {
    await User.updateOne({ _id: userId }, { $set });
  }
};
