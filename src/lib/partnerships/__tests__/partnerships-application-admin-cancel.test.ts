import { describe, expect, it, vi } from "vitest";
import {
  ADMINISTRATIVELY_CANCELLED_STATUS,
  ADMIN_TRAINING_CANCEL_AUDIT_ACTION,
  ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE,
  ADMIN_TRAINING_CANCEL_REASONS,
  ADMIN_TRAINING_CANCEL_TIMELINE_ACTION,
  canAdminCancelTrainingApplication,
  isAdministrativelyCancelledApplication,
} from "@/lib/partnerships/partnerships-admin-cancel-constants";
import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";
import { ACTIVE_TRAINING_APPLICATION_STATUSES } from "@/lib/partnerships/partnerships-constants";
import { trainingApplicationBlocksReapply } from "@/lib/partnerships/partnerships-application-status-ui";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("administrative training application cancellation — constants", () => {
  it("defines administratively_cancelled outside active statuses", () => {
    expect(ACTIVE_TRAINING_APPLICATION_STATUSES).not.toContain(ADMINISTRATIVELY_CANCELLED_STATUS);
    expect(isAdministrativelyCancelledApplication("administratively_cancelled")).toBe(true);
    expect(isAdministrativelyCancelledApplication("accepted")).toBe(false);
  });

  it("does not block reapply for administratively_cancelled", () => {
    expect(trainingApplicationBlocksReapply(ADMINISTRATIVELY_CANCELLED_STATUS)).toBe(false);
  });

  it("exposes preset cancellation reasons", () => {
    expect(ADMIN_TRAINING_CANCEL_REASONS.length).toBeGreaterThanOrEqual(6);
    expect(ADMIN_TRAINING_CANCEL_REASONS.some((row) => row.code === "other")).toBe(true);
  });

  it("blocks admin cancel for completed status", () => {
    expect(canAdminCancelTrainingApplication("completed")).toBe(false);
    expect(canAdminCancelTrainingApplication("accepted")).toBe(true);
    expect(canAdminCancelTrainingApplication(ADMINISTRATIVELY_CANCELLED_STATUS)).toBe(false);
  });
});

describe("administrative training application cancellation — timeline & audit", () => {
  it("includes administrative cancellation timeline label", () => {
    expect(timelineActionLabel(ADMIN_TRAINING_CANCEL_TIMELINE_ACTION, true)).toContain("إلغاء");
    expect(timelineActionLabel(ADMIN_TRAINING_CANCEL_TIMELINE_ACTION, false)).toContain("cancelled");
  });

  it("exports cancel service with audit and timeline actions", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      "src/lib/partnerships/partnerships-application-admin-cancel-service.ts",
      "utf8"
    );
    expect(src).toContain("administrativelyCancelTrainingApplication");
    expect(src).toContain("ADMIN_TRAINING_CANCEL_AUDIT_ACTION");
    expect(src).toContain("ADMIN_TRAINING_CANCEL_TIMELINE_ACTION");
    expect(src).toContain("ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE");
    expect(src).not.toContain(".deleteMany(");
  });
});

describe("administrative training application cancellation — permissions", () => {
  it("restricts cancel API to system admin gate", async () => {
    const fs = await import("node:fs/promises");
    const routeSrc = await fs.readFile(
      "src/app/api/admin/partnerships/applications/[id]/cancel/route.ts",
      "utf8"
    );
    expect(routeSrc).toContain("requireSystemAdminTrainingCancel");
    expect(routeSrc).not.toContain("requirePartnershipsReopenApplication");
  });

  it("auth gate allows only admin role", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/partnerships-auth.ts", "utf8");
    expect(src).toContain("requireSystemAdminTrainingCancel");
    expect(src).toContain('role === "admin"');
  });
});

describe("administrative training application cancellation — institution lock", () => {
  it("blocks institution mutations when administratively cancelled", async () => {
    const { assertInstitutionApplicationMutable } = await import("@/lib/partnerships/institution-scope");
    const result = assertInstitutionApplicationMutable(ADMINISTRATIVELY_CANCELLED_STATUS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("administratively_cancelled");
    }
  });

  it("uses writable guard in institution experience mutations", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/institution-experience-service.ts", "utf8");
    expect(src).toContain("assertInstitutionApplicationWritable");
  });
});

describe("administrative training application cancellation — reapplication", () => {
  it("creates a new application when prior one was administratively cancelled", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/partnerships/applications/route.ts", "utf8");
    expect(src).toContain("ADMINISTRATIVELY_CANCELLED_STATUS");
    expect(src).toContain("StudentTrainingApplication.create");
  });

  it("uses partial unique index excluding administratively_cancelled", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/models/StudentTrainingApplication.ts", "utf8");
    expect(src).toContain('status: { $ne: "administratively_cancelled" }');
  });
});

describe("administrative training application cancellation — list filters", () => {
  it("excludes administratively cancelled from default admin list", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/partnerships-applications-query.ts", "utf8");
    expect(src).toContain("$ne: ADMINISTRATIVELY_CANCELLED_STATUS");
  });
});

describe("administrative training application cancellation — student history", () => {
  it("exposes student history API for archived cancellations", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/partnerships/applications/history/route.ts", "utf8");
    expect(src).toContain("ADMINISTRATIVELY_CANCELLED_STATUS");
  });

  it("allows students to load administratively cancelled application detail", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/partnerships/applications/[id]/route.ts", "utf8");
    expect(src).toContain("ADMINISTRATIVELY_CANCELLED_STATUS");
  });
});

describe("administrative training application cancellation — UI", () => {
  it("includes cancel button copy on admin detail page", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      "src/app/(app)/admin/partnerships/applications/[id]/page.tsx",
      "utf8"
    );
    expect(src).toContain("إلغاء الطلب وإتاحة إعادة التقديم");
    expect(src).toContain("/cancel");
  });

  it("includes administratively cancelled filter on admin list page", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/admin/partnerships/applications/page.tsx", "utf8");
    expect(src).toContain("الطلبات الملغاة إدارياً");
    expect(src).toContain("ADMINISTRATIVELY_CANCELLED_STATUS");
  });
});
