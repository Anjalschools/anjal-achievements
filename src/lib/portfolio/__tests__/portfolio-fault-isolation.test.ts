import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as achievementDisplay from "@/lib/achievementDisplay";
import * as evidenceRef from "@/lib/portfolio/portfolio-evidence-ref";
import {
  buildPublicPortfolioEvidenceItems,
  tryBuildPublicPortfolioEvidenceItem,
} from "@/lib/portfolio/portfolio-evidence-policy";
import {
  createPortfolioFaultContext,
  logPortfolioFault,
} from "@/lib/portfolio/portfolio-fault-diagnostics";
import { buildPublicPortfolioAchievementItemsResilient } from "@/lib/portfolio/public-portfolio-achievement-item";

const ACHIEVEMENT_ID = "507f1f77bcf86cd799439011";
const ACHIEVEMENT_ID_2 = "507f1f77bcf86cd799439012";

const visibleAttachment = (overrides: Record<string, unknown> = {}) => ({
  url: "https://example.com/file.pdf",
  mimeType: "application/pdf",
  name: "certificate.pdf",
  approved: true,
  showInPublicPortfolio: true,
  ...overrides,
});

const approvedRow = (id: string, attachments: unknown[] = [visibleAttachment()]) => ({
  _id: id,
  status: "approved",
  achievementType: "competition",
  achievementName: "math_olympiad",
  nameAr: "إنجاز",
  nameEn: "Achievement",
  description: "Sample",
  achievementLevel: "school",
  participationType: "individual",
  resultType: "medal",
  medalType: "gold",
  score: 10,
  achievementYear: 2025,
  date: new Date("2025-05-01"),
  attachments,
});

describe("portfolio fault isolation", () => {
  beforeEach(() => {
    process.env.PORTFOLIO_EVIDENCE_SECRET = "test-portfolio-evidence-secret";
  });

  afterEach(() => {
    delete process.env.PORTFOLIO_EVIDENCE_SECRET;
    vi.restoreAllMocks();
  });

  it("skips one failing achievement and keeps the rest", () => {
    vi.spyOn(achievementDisplay, "getAchievementDisplayName").mockImplementation((row, loc) => {
      if (String((row as { _id?: unknown })._id ?? "") === ACHIEVEMENT_ID) {
        throw new Error("achievement build failed");
      }
      return loc === "ar" ? "إنجاز" : "Achievement";
    });

    const items = buildPublicPortfolioAchievementItemsResilient(
      [approvedRow(ACHIEVEMENT_ID), approvedRow(ACHIEVEMENT_ID_2)],
      { studentId: "507f1f77bcf86cd799439099", portfolioSlug: "student-a" }
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(ACHIEVEMENT_ID_2);
  });

  it("skips one corrupt attachment and keeps the rest", () => {
    let refCalls = 0;
    const originalCreateRef = evidenceRef.createPortfolioEvidenceRef;
    vi.spyOn(evidenceRef, "createPortfolioEvidenceRef").mockImplementation((input) => {
      refCalls += 1;
      if (refCalls === 1) {
        throw new Error("signed ref failed");
      }
      return originalCreateRef(input);
    });

    const items = buildPublicPortfolioEvidenceItems({
      achievementId: ACHIEVEMENT_ID,
      attachmentsRaw: [
        visibleAttachment({ name: "bad.pdf" }),
        visibleAttachment({ name: "good.jpg", mimeType: "image/jpeg" }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("good.jpg");
  });

  it("does not throw for invalid attachment data", () => {
    const item = tryBuildPublicPortfolioEvidenceItem({
      achievementId: ACHIEVEMENT_ID,
      attachmentIndex: 0,
      attachment: {
        url: "https://example.com/x",
        mimeType: "",
        name: "",
        approved: true,
        showInPublicPortfolio: true,
      },
    });

    expect(item).toMatchObject({
      name: "attachment",
      mimeType: "application/octet-stream",
      kind: "document",
    });
  });

  it("returns null when signed ref cannot be created for an attachment", () => {
    const item = tryBuildPublicPortfolioEvidenceItem({
      achievementId: "invalid-id",
      attachmentIndex: 0,
      attachment: visibleAttachment(),
    });

    expect(item).toBeNull();
  });

  it("renders achievements with no public evidence normally", () => {
    const items = buildPublicPortfolioAchievementItemsResilient(
      [approvedRow(ACHIEVEMENT_ID, [{ url: "https://example.com/hidden.pdf", mimeType: "application/pdf", name: "hidden.pdf" }])],
      { studentId: "507f1f77bcf86cd799439099", portfolioSlug: "student-a" }
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.evidence).toEqual([]);
  });

  it("logs each distinct fault only once", () => {
    const faultCtx = createPortfolioFaultContext({
      studentId: "507f1f77bcf86cd799439099",
      portfolioSlug: "student-a",
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("duplicate");

    logPortfolioFault(faultCtx, "attachment", error, {
      achievementId: ACHIEVEMENT_ID,
      attachmentIndex: 0,
      attachmentName: "a.pdf",
    });
    logPortfolioFault(faultCtx, "attachment", error, {
      achievementId: ACHIEVEMENT_ID,
      attachmentIndex: 0,
      attachmentName: "a.pdf",
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("does not include secrets in structured fault logs", () => {
    const faultCtx = createPortfolioFaultContext({
      studentId: "507f1f77bcf86cd799439099",
      portfolioSlug: "student-a",
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logPortfolioFault(faultCtx, "attachment", new Error("boom"), {
      achievementId: ACHIEVEMENT_ID,
      attachmentName: "secret-token-should-not-appear.pdf",
    });

    const payload = JSON.stringify(consoleSpy.mock.calls[0]?.[1]);
    expect(payload).not.toContain("publicPortfolioToken");
    expect(payload).not.toContain("NEXTAUTH");
    expect(payload).not.toContain("r2://");
    consoleSpy.mockRestore();
  });
});
