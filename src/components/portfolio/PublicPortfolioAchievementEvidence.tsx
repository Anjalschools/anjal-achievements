"use client";

import type { PublicPortfolioEvidenceItem } from "@/lib/portfolio/portfolio-evidence-types";
import PublicPortfolioEvidenceGallery from "@/components/portfolio/PublicPortfolioEvidenceGallery";
import { PublicPortfolioEvidenceGalleryErrorBoundary } from "@/components/portfolio/PublicPortfolioEvidenceGalleryErrorBoundary";

type PublicPortfolioAchievementEvidenceProps = {
  items: PublicPortfolioEvidenceItem[];
  slug: string;
  token: string;
  isAr: boolean;
  achievementId: string;
};

const PublicPortfolioAchievementEvidence = ({
  items,
  slug,
  token,
  isAr,
  achievementId,
}: PublicPortfolioAchievementEvidenceProps) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <PublicPortfolioEvidenceGalleryErrorBoundary achievementId={achievementId}>
      <PublicPortfolioEvidenceGallery
        items={items}
        slug={slug}
        token={token}
        isAr={isAr}
      />
    </PublicPortfolioEvidenceGalleryErrorBoundary>
  );
};

export default PublicPortfolioAchievementEvidence;
