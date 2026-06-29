import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildPublicPortfolioEvidenceItems,
  filterPublicPortfolioEvidenceItems,
  inferPortfolioEvidenceCategory,
  inferPortfolioEvidenceKind,
  isAttachmentPublicPortfolioVisible,
} from "@/lib/portfolio/portfolio-evidence-policy";

const ACHIEVEMENT_ID = "507f1f77bcf86cd799439011";

describe("portfolio evidence policy", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-portfolio-evidence-secret";
  });

  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  it("requires both approved and showInPublicPortfolio", () => {
    expect(
      isAttachmentPublicPortfolioVisible({
        url: "https://example.com/a.pdf",
        mimeType: "application/pdf",
        name: "cert.pdf",
      })
    ).toBe(false);
    expect(
      isAttachmentPublicPortfolioVisible({
        url: "https://example.com/a.pdf",
        mimeType: "application/pdf",
        name: "cert.pdf",
        showInPublicPortfolio: true,
      })
    ).toBe(false);
    expect(
      isAttachmentPublicPortfolioVisible({
        url: "https://example.com/a.pdf",
        mimeType: "application/pdf",
        name: "cert.pdf",
        approved: true,
        showInPublicPortfolio: true,
      })
    ).toBe(true);
  });

  it("builds public evidence only for approved visible attachments", () => {
    const items = buildPublicPortfolioEvidenceItems({
      achievementId: ACHIEVEMENT_ID,
      attachmentsRaw: [
        {
          url: "https://example.com/hidden.jpg",
          mimeType: "image/jpeg",
          name: "hidden.jpg",
        },
        {
          url: "https://example.com/public.pdf",
          mimeType: "application/pdf",
          name: "certificate.pdf",
          approved: true,
          showInPublicPortfolio: true,
          evidenceCategory: "certificate",
        },
        {
          url: "https://example.com/photo.jpg",
          mimeType: "image/jpeg",
          name: "activity-photo.jpg",
          approved: true,
          showInPublicPortfolio: true,
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe("pdf");
    expect(items[0]?.category).toBe("certificate");
    expect(items[1]?.kind).toBe("image");
    expect(items[1]?.category).toBe("photo");
    expect(items.every((item) => item.ref.includes("."))).toBe(true);
  });

  it("filters mixed evidence categories", () => {
    const items = buildPublicPortfolioEvidenceItems({
      achievementId: ACHIEVEMENT_ID,
      attachmentsRaw: [
        {
          url: "https://example.com/a.pdf",
          mimeType: "application/pdf",
          name: "cert.pdf",
          approved: true,
          showInPublicPortfolio: true,
          evidenceCategory: "certificate",
        },
        {
          url: "https://example.com/b.jpg",
          mimeType: "image/jpeg",
          name: "photo.jpg",
          approved: true,
          showInPublicPortfolio: true,
        },
      ],
    });

    expect(filterPublicPortfolioEvidenceItems(items, "pdf")).toHaveLength(1);
    expect(filterPublicPortfolioEvidenceItems(items, "photo")).toHaveLength(1);
    expect(filterPublicPortfolioEvidenceItems(items, "certificate")).toHaveLength(1);
    expect(filterPublicPortfolioEvidenceItems(items, "all")).toHaveLength(2);
  });

  it("infers mime and category heuristics", () => {
    expect(inferPortfolioEvidenceKind("application/pdf")).toBe("pdf");
    expect(inferPortfolioEvidenceKind("image/png")).toBe("image");
    expect(
      inferPortfolioEvidenceCategory({ mimeType: "application/pdf", name: "award-letter.pdf" })
    ).toBe("certificate");
    expect(
      inferPortfolioEvidenceCategory({ mimeType: "image/jpeg", name: "trophy-photo.jpg" })
    ).toBe("photo");
  });
});
