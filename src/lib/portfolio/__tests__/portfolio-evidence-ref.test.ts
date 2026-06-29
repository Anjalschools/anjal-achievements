import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createPortfolioEvidenceRef,
  parsePortfolioEvidenceRef,
} from "@/lib/portfolio/portfolio-evidence-ref";

const ACHIEVEMENT_ID = "507f1f77bcf86cd799439011";

describe("portfolio evidence ref signing", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-portfolio-evidence-secret";
  });

  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  it("round-trips achievement id and attachment index", () => {
    const ref = createPortfolioEvidenceRef({ achievementId: ACHIEVEMENT_ID, attachmentIndex: 2 });
    const parsed = parsePortfolioEvidenceRef(ref);
    expect(parsed).toEqual({ achievementId: ACHIEVEMENT_ID, attachmentIndex: 2 });
  });

  it("rejects tampered signatures", () => {
    const ref = createPortfolioEvidenceRef({ achievementId: ACHIEVEMENT_ID, attachmentIndex: 0 });
    const tampered = `${ref.slice(0, -4)}xxxx`;
    expect(parsePortfolioEvidenceRef(tampered)).toBeNull();
  });

  it("rejects malformed refs", () => {
    expect(parsePortfolioEvidenceRef("")).toBeNull();
    expect(parsePortfolioEvidenceRef("not-a-ref")).toBeNull();
  });
});
