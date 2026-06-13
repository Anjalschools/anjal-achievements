import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { buildPublicPortfolioUrl } from "@/lib/public-portfolio";
import { ensureStudentPublicPortfolioReady } from "@/lib/public-portfolio-bootstrap";
import { getBaseUrl } from "@/lib/get-base-url";

export type PartnershipStudentPortfolioAccess = {
  enabled: boolean;
  url: string | null;
  slug: string | null;
  publishedAt: string | null;
};

export const getPartnershipStudentPortfolioAccess = async (
  studentId: string
): Promise<PartnershipStudentPortfolioAccess> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    return { enabled: false, url: null, slug: null, publishedAt: null };
  }

  await ensureStudentPublicPortfolioReady(studentId);

  const row = await User.findById(studentId)
    .select("+publicPortfolioToken publicPortfolioEnabled publicPortfolioSlug publicPortfolioPublishedAt role")
    .lean();

  if (!row || String((row as { role?: string }).role || "") !== "student") {
    return { enabled: false, url: null, slug: null, publishedAt: null };
  }

  const r = row as unknown as Record<string, unknown>;
  const enabled = r.publicPortfolioEnabled === true;
  const slug =
    typeof r.publicPortfolioSlug === "string" && r.publicPortfolioSlug.trim()
      ? r.publicPortfolioSlug.trim().toLowerCase()
      : "";
  const token =
    typeof r.publicPortfolioToken === "string" && r.publicPortfolioToken.trim()
      ? r.publicPortfolioToken.trim()
      : "";
  const publishedAt =
    r.publicPortfolioPublishedAt instanceof Date ? r.publicPortfolioPublishedAt.toISOString() : null;
  const url = enabled && slug && token ? buildPublicPortfolioUrl({ slug, token, baseUrl: getBaseUrl() }) : null;

  return { enabled, url, slug: slug || null, publishedAt };
};
