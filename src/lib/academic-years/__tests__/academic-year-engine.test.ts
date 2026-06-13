import { describe, expect, it, vi } from "vitest";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";
import { formatAcademicYearLabel } from "@/lib/academic-year";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("academic year engine foundation", () => {
  it("formats academic year labels consistently", () => {
    expect(formatAcademicYearLabel(2026)).toBe("2026/2027");
  });

  it("exposes academic year model statuses", async () => {
    const mod = await import("@/models/AcademicYear");
    expect(mod.default).toBeTruthy();
  });

  it("exposes academic snapshot model foundation", async () => {
    const mod = await import("@/models/AcademicSnapshot");
    expect(mod.default).toBeTruthy();
  });

  it("keeps training workflow state machine unchanged", () => {
    const result = validateApplicationTransition("submitted", "institution_review");
    expect(result.ok).toBe(false);
  });
});

describe("academic year display helpers", () => {
  it("resolveAcademicYearForLegacyRecord uses stored label when present", async () => {
    const { resolveAcademicYearForLegacyRecord } = await import(
      "@/lib/academic-years/academic-year-display"
    );
    const label = await resolveAcademicYearForLegacyRecord({
      academicYear: "unknown",
      academicYearLabel: "2025/2026",
    });
    expect(label).toBe("2025/2026");
  });
});

describe("promotion preview services", () => {
  it("exports preview-only promotion helpers", async () => {
    const mod = await import("@/lib/academic-years/promotion-preview");
    expect(typeof mod.getPromotionPreview).toBe("function");
    expect(typeof mod.getEligibleStudents).toBe("function");
    expect(typeof mod.buildPromotionPlan).toBe("function");
  });
});
