import { describe, expect, it, vi } from "vitest";
import {
  PARTNER_ORGANIZATION_CATEGORIES,
  PARTNER_ORGANIZATION_CATEGORY_LABELS,
  isValidPartnerOrganizationCategory,
} from "@/lib/partnerships/institution-analytics-constants";
import { INSTITUTION_REVIEW_KINDS } from "@/lib/partnerships/institution-experience-constants";
import { INSTITUTION_DECISION_STATUSES } from "@/lib/partnerships/partnerships-messaging-constants";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("institution classification", () => {
  it("exports all required organization categories", () => {
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("health");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("technology");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("engineering");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("university");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("research");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("administrative");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("legal");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("media");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("education");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("entrepreneurship");
    expect(PARTNER_ORGANIZATION_CATEGORIES).toContain("other");
    expect(PARTNER_ORGANIZATION_CATEGORIES.length).toBe(11);
  });

  it("provides bilingual labels for categories", () => {
    expect(PARTNER_ORGANIZATION_CATEGORY_LABELS.health.ar).toBe("صحية");
    expect(PARTNER_ORGANIZATION_CATEGORY_LABELS.technology.en).toBe("Technology");
  });

  it("validates category values", () => {
    expect(isValidPartnerOrganizationCategory("health")).toBe(true);
    expect(isValidPartnerOrganizationCategory("invalid")).toBe(false);
    expect(isValidPartnerOrganizationCategory("")).toBe(false);
  });
});

describe("institution review — student feedback", () => {
  it("includes student_feedback review kind", () => {
    expect(INSTITUTION_REVIEW_KINDS).toContain("student_feedback");
  });

  it("includes institution_student_feedback decision status", () => {
    expect(INSTITUTION_DECISION_STATUSES).toContain("institution_student_feedback");
  });

  it("exports student feedback service helpers", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/institution-student-feedback-service.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
    const src = await fs.readFile(file, "utf8");
    expect(src).toContain("getStudentFeedbackForApplication");
    expect(src).toContain("submitStudentFeedback");
  });
});

describe("institution analytics service", () => {
  it("exports analytics helpers", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/institution-analytics-service.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
    const src = await fs.readFile(file, "utf8");
    expect(src).toContain("buildOrganizationPerformanceStats");
    expect(src).toContain("buildGlobalInstitutionInsights");
    expect(src).toContain("recomputeOrganizationRating");
    expect(src).toContain("buildPartnershipAnalyticsSummary");
  });
});

describe("serialization backward compatibility", () => {
  it("serializes organization without new fields", async () => {
    const { serializePartnerOrganization } = await import("@/lib/partnerships/partnerships-serialize");
    const row = serializePartnerOrganization({
      _id: { toString: () => "507f1f77bcf86cd799439011" },
      name: "Legacy Org",
      active: true,
    });
    expect(row.name).toBe("Legacy Org");
    expect(row.category).toBe("");
    expect(row.subCategory).toBe("");
    expect(row.averageRating).toBe(0);
    expect(row.ratingCount).toBe(0);
  });

  it("serializes organization with classification and rating", async () => {
    const { serializePartnerOrganization } = await import("@/lib/partnerships/partnerships-serialize");
    const row = serializePartnerOrganization({
      _id: { toString: () => "507f1f77bcf86cd799439011" },
      name: "Tech Org",
      category: "technology",
      subCategory: "Software",
      averageRating: 4.2,
      ratingCount: 5,
      active: true,
    });
    expect(row.category).toBe("technology");
    expect(row.subCategory).toBe("Software");
    expect(row.averageRating).toBe(4.2);
    expect(row.ratingCount).toBe(5);
  });
});

describe("analytics integration — additive only", () => {
  it("career analytics service exports partnershipAnalytics in dashboard shape", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/career/career-analytics-service.ts", "utf8");
    expect(src).toContain("partnershipAnalytics");
    expect(src).toContain("buildPartnershipAnalyticsSummary");
  });

  it("executive intelligence includes partnershipAnalytics field", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/analytics/executive-decision-intelligence-service.ts", "utf8");
    expect(src).toContain("partnershipAnalytics");
  });

  it("partnerships export adds rating columns without removing existing headers", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/partnerships-export-service.ts", "utf8");
    expect(src).toContain("averageRating");
    expect(src).toContain("category");
    expect(src).toContain("opportunityCount");
    expect(src).toContain("acceptedCount");
  });
});

describe("regression protection — protected engines untouched", () => {
  it("training achievement automation remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/training-achievement-automation.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });

  it("training completion review service remains present", async () => {
    const mod = await import("@/lib/partnerships/training-completion-service");
    expect(typeof mod.reviewTrainingCompletionReport).toBe("function");
  });

  it("academic year resolver remains importable", async () => {
    const mod = await import("@/lib/academic-years/current-academic-year");
    expect(typeof mod.getCurrentAcademicYear).toBe("function");
  });

  it("career profile service source remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/career/student-career-profile-service.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });

  it("partnerships state machine remains present", async () => {
    const mod = await import("@/lib/partnerships/partnerships-state-machine");
    expect(typeof mod.validateApplicationTransition).toBe("function");
  });
});

describe("admin and student routes", () => {
  it("organization analytics page exists", async () => {
    const fs = await import("node:fs/promises");
    await expect(
      fs.access("src/app/(app)/admin/partnerships/organizations/[id]/page.tsx")
    ).resolves.toBeUndefined();
  });

  it("student feedback history page exists", async () => {
    const fs = await import("node:fs/promises");
    await expect(fs.access("src/app/(app)/summer-training/history/[id]/page.tsx")).resolves.toBeUndefined();
  });

  it("student training history alias route exists", async () => {
    const fs = await import("node:fs/promises");
    await expect(fs.access("src/app/(app)/student/training/history/[id]/page.tsx")).resolves.toBeUndefined();
  });
});
