import type mongoose from "mongoose";

/**
 * When an achievement becomes approved/published, it should appear in the student's
 * public portfolio by default — unless the school explicitly opted out
 * (`publicPortfolioSuppressedByAdmin === true`).
 */
export const applyDefaultShowInPublicPortfolioWhenPublished = (
  doc: mongoose.Document
): void => {
  if (doc.get("publicPortfolioSuppressedByAdmin") === true) {
    return;
  }
  doc.set("showInPublicPortfolio", true);
};
