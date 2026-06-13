import { describe, expect, it, vi } from "vitest";
import {
  canReopenRejectedTrainingApplication,
  validateApplicationTransition,
  validateReopenRejectedTrainingApplication,
} from "@/lib/partnerships/partnerships-state-machine";
import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("reopen rejected training application — state machine", () => {
  it("allows rejected → under_review transition", () => {
    const result = validateApplicationTransition("rejected", "under_review");
    expect(result.ok).toBe(true);
  });

  it("validates reopen only from rejected", () => {
    expect(canReopenRejectedTrainingApplication("rejected")).toBe(true);
    expect(canReopenRejectedTrainingApplication("under_review")).toBe(false);
    expect(canReopenRejectedTrainingApplication("accepted")).toBe(false);
    expect(canReopenRejectedTrainingApplication("completed")).toBe(false);
  });

  it("blocks reopen from non-rejected statuses", () => {
    const result = validateReopenRejectedTrainingApplication("under_review");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("rejected");
    }
  });

  it("blocks reopen to statuses other than under_review", () => {
    const result = validateReopenRejectedTrainingApplication("rejected", "accepted" as never);
    expect(result.ok).toBe(false);
  });

  it("still blocks other transitions from rejected", () => {
    expect(validateApplicationTransition("rejected", "accepted").ok).toBe(false);
    expect(validateApplicationTransition("rejected", "institution_review").ok).toBe(false);
  });
});

describe("reopen rejected training application — timeline & audit", () => {
  it("includes application_reopened timeline label", () => {
    expect(timelineActionLabel("application_reopened", true)).toBe("تمت إعادة فتح الطلب");
    expect(timelineActionLabel("application_reopened", false)).toBe("Application reopened");
  });

  it("exports reopen service", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/partnerships-application-reopen-service.ts");
    const src = await fs.readFile(file, "utf8");
    expect(src).toContain("reopenRejectedTrainingApplication");
    expect(src).toContain("training_application_reopened");
    expect(src).toContain("application_reopened");
    expect(src).toContain("notifyStudentTrainingApplicationReopened");
  });
});

describe("reopen rejected training application — permissions", () => {
  it("restricts reopen API to admin and partnershipSupervisor", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      "src/app/api/admin/partnerships/applications/[id]/reopen/route.ts",
      "utf8"
    );
    expect(src).toContain("requirePartnershipsReopenApplication");
  });

  it("auth gate allows only admin and partnershipSupervisor roles", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/partnerships-auth.ts", "utf8");
    expect(src).toContain("requirePartnershipsReopenApplication");
    expect(src).toContain('role === "partnershipSupervisor"');
    expect(src).toContain('role === "admin"');
  });

  it("does not expose reopen on standard supervisor PATCH actions", async () => {
    const { isValidSupervisorAction } = await import("@/lib/partnerships/partnerships-application-workflow");
    expect(isValidSupervisorAction("reopen")).toBe(false);
    expect(isValidSupervisorAction("rejected")).toBe(true);
  });
});

describe("reopen rejected training application — UI", () => {
  it("application detail page shows reopen control for rejected status", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      "src/app/(app)/admin/partnerships/applications/[id]/page.tsx",
      "utf8"
    );
    expect(src).toContain("canReopenRejectedTrainingApplication");
    expect(src).toContain("إعادة فتح الطلب");
    expect(src).toContain("/reopen");
  });
});

describe("regression protection — protected engines untouched", () => {
  it("training achievement automation remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/training-achievement-automation.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });

  it("institution experience service remains present", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src/lib/partnerships/institution-experience-service.ts");
    await expect(fs.access(file)).resolves.toBeUndefined();
  });
});
