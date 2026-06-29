import { describe, expect, it } from "vitest";

import { isAttachmentPublicPortfolioVisible } from "@/lib/portfolio/portfolio-evidence-policy";
import {
  attachmentHasExplicitPublicVisibility,
  backfillLegacyAttachmentsArray,
  isAchievementApprovedForPublicPortfolio,
  isPreP1Achievement,
  planLegacyEvidenceBackfillForAchievement,
} from "@/lib/migrations/legacy-portfolio-evidence-backfill";

const P1_LAUNCH = new Date("2026-06-18T00:00:00.000Z");

const legacyApprovedAchievement = (overrides: Record<string, unknown> = {}) => ({
  status: "approved",
  approved: true,
  pendingReReview: false,
  createdAt: new Date("2025-09-01T00:00:00.000Z"),
  attachments: [
    {
      url: "https://cdn.example.com/cert.pdf",
      mimeType: "application/pdf",
      name: "certificate.pdf",
    },
    {
      url: "https://cdn.example.com/photo.jpg",
      mimeType: "image/jpeg",
      name: "activity.jpg",
    },
  ],
  ...overrides,
});

describe("legacy portfolio evidence backfill", () => {
  it("updates attachments on legacy approved achievements", () => {
    const plan = planLegacyEvidenceBackfillForAchievement(legacyApprovedAchievement(), P1_LAUNCH);
    expect(plan.action).toBe("update");
    if (plan.action !== "update") return;

    expect(plan.attachmentsUpdated).toBe(2);
    for (const item of plan.attachments) {
      expect(item).toMatchObject({
        approved: true,
        showInPublicPortfolio: true,
      });
      expect(isAttachmentPublicPortfolioVisible(item as { approved?: boolean; showInPublicPortfolio?: boolean; url: string; mimeType: string; name: string })).toBe(true);
    }
  });

  it("does not update unapproved achievements", () => {
    const plan = planLegacyEvidenceBackfillForAchievement(
      legacyApprovedAchievement({ status: "pending", approved: false }),
      P1_LAUNCH
    );
    expect(plan).toEqual({ action: "skip", reason: "not_approved" });
  });

  it("does not overwrite attachments that already have showInPublicPortfolio", () => {
    const hidden = {
      url: "https://cdn.example.com/private.pdf",
      mimeType: "application/pdf",
      name: "private.pdf",
      showInPublicPortfolio: false,
      approved: false,
    };
    const plan = planLegacyEvidenceBackfillForAchievement(
      legacyApprovedAchievement({
        attachments: [
          hidden,
          {
            url: "https://cdn.example.com/old.jpg",
            mimeType: "image/jpeg",
            name: "old.jpg",
          },
        ],
      }),
      P1_LAUNCH
    );

    expect(plan.action).toBe("update");
    if (plan.action !== "update") return;

    expect(plan.attachmentsUpdated).toBe(1);
    expect(plan.attachments[0]).toEqual(hidden);
    expect(plan.attachments[1]).toMatchObject({
      approved: true,
      showInPublicPortfolio: true,
      name: "old.jpg",
    });
  });

  it("is idempotent on a second run", () => {
    const first = planLegacyEvidenceBackfillForAchievement(legacyApprovedAchievement(), P1_LAUNCH);
    expect(first.action).toBe("update");
    if (first.action !== "update") return;

    const second = planLegacyEvidenceBackfillForAchievement(
      { ...legacyApprovedAchievement(), attachments: first.attachments },
      P1_LAUNCH
    );
    expect(second).toEqual({ action: "skip", reason: "no_changes" });
  });

  it("skips post-P.1 achievements even when attachments lack visibility fields", () => {
    const plan = planLegacyEvidenceBackfillForAchievement(
      legacyApprovedAchievement({
        createdAt: new Date("2026-06-19T00:00:00.000Z"),
      }),
      P1_LAUNCH
    );
    expect(plan).toEqual({ action: "skip", reason: "post_p1" });
  });

  it("preserves evidenceCategory and attachment order", () => {
    const { next, attachmentsUpdated } = backfillLegacyAttachmentsArray([
      {
        url: "https://cdn.example.com/a.pdf",
        mimeType: "application/pdf",
        name: "a.pdf",
        evidenceCategory: "certificate",
        key: "achievements/a.pdf",
      },
      "https://cdn.example.com/b.jpg",
    ]);

    expect(attachmentsUpdated).toBe(2);
    expect(next[0]).toMatchObject({
      evidenceCategory: "certificate",
      key: "achievements/a.pdf",
      approved: true,
      showInPublicPortfolio: true,
    });
    expect(next[1]).toMatchObject({
      approved: true,
      showInPublicPortfolio: true,
      mimeType: "image/jpeg",
    });
  });

  it("detects explicit admin visibility on attachment objects only", () => {
    expect(attachmentHasExplicitPublicVisibility("https://example.com/a.pdf")).toBe(false);
    expect(attachmentHasExplicitPublicVisibility({ showInPublicPortfolio: false })).toBe(true);
    expect(attachmentHasExplicitPublicVisibility({ showInPublicPortfolio: true })).toBe(true);
    expect(attachmentHasExplicitPublicVisibility({ url: "https://example.com/a.pdf" })).toBe(false);
  });

  it("matches approved portfolio achievement rules", () => {
    expect(isAchievementApprovedForPublicPortfolio({ status: "approved" })).toBe(true);
    expect(isAchievementApprovedForPublicPortfolio({ approved: true })).toBe(true);
    expect(isAchievementApprovedForPublicPortfolio({ status: "pending" })).toBe(false);
    expect(isAchievementApprovedForPublicPortfolio({ status: "approved", showInPublicPortfolio: false })).toBe(
      false
    );
    expect(isPreP1Achievement({ createdAt: new Date("2025-01-01") }, P1_LAUNCH)).toBe(true);
    expect(isPreP1Achievement({ createdAt: new Date("2026-06-18T12:00:00.000Z") }, P1_LAUNCH)).toBe(false);
  });
});
