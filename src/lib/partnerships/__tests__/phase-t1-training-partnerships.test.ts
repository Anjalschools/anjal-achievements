import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

import {
  canDeletePartnershipMessage,
  canEditPartnershipMessage,
  canRestorePartnershipMessage,
  DELETED_MESSAGE_PLACEHOLDER_AR,
  PARTNERSHIP_MESSAGE_DELETE_UNDO_MS,
} from "@/lib/partnerships/partnership-message-mutation-service";

describe("partnership message mutation permissions", () => {
  const userId = "507f1f77bcf86cd799439011";
  const otherId = "507f1f77bcf86cd799439012";

  it("allows supervisor roles to edit own messages only", () => {
    expect(canEditPartnershipMessage({ role: "admin", senderId: userId, userId })).toBe(true);
    expect(canEditPartnershipMessage({ role: "partnershipSupervisor", senderId: userId, userId })).toBe(
      true
    );
    expect(canEditPartnershipMessage({ role: "admin", senderId: otherId, userId })).toBe(false);
    expect(canEditPartnershipMessage({ role: "trainingInstitution", senderId: userId, userId })).toBe(
      false
    );
    expect(canEditPartnershipMessage({ role: "student", senderId: userId, userId })).toBe(false);
  });

  it("allows owners in supported roles to delete messages", () => {
    expect(canDeletePartnershipMessage({ role: "student", senderId: userId, userId })).toBe(true);
    expect(canDeletePartnershipMessage({ role: "trainingInstitution", senderId: userId, userId })).toBe(
      true
    );
    expect(canDeletePartnershipMessage({ role: "student", senderId: otherId, userId })).toBe(false);
  });

  it("allows restore only inside the undo window", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000);
    const expired = new Date(Date.now() - PARTNERSHIP_MESSAGE_DELETE_UNDO_MS - 1000);
    expect(canRestorePartnershipMessage({ isDeleted: true, deletedAt: recent })).toBe(true);
    expect(canRestorePartnershipMessage({ isDeleted: true, deletedAt: expired })).toBe(false);
    expect(canRestorePartnershipMessage({ isDeleted: false, deletedAt: recent })).toBe(false);
  });

  it("uses Arabic deleted placeholder constant", () => {
    expect(DELETED_MESSAGE_PLACEHOLDER_AR).toBe("تم حذف هذه الرسالة");
  });
});

describe("Phase T.1 infrastructure", () => {
  const readSrc = async (relativePath: string) => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
  };

  it("exposes message mutation API routes", async () => {
    expect(await readSrc("src/app/api/partnerships/messages/[id]/route.ts")).toContain("editPartnershipMessage");
    expect(await readSrc("src/app/api/partnerships/messages/[id]/restore/route.ts")).toContain(
      "restorePartnershipMessage"
    );
    expect(await readSrc("src/app/api/institution/training/messages/[id]/route.ts")).toContain(
      "softDeletePartnershipMessage"
    );
  });

  it("generates approved students PDF with official header", async () => {
    const src = await readSrc("src/lib/partnerships/approved-students-pdf-service.ts");
    expect(src).toContain("report-header.png");
    expect(src).toContain("كشف الطلاب المعتمدين للتدريب الصيفي");
    expect(await readSrc("src/app/api/training/reports/approved-students/route.ts")).toContain(
      "buildApprovedStudentsPdf"
    );
  });

  it("supports academic year archive and dashboard summary", async () => {
    expect(await readSrc("src/lib/academic-years/academic-year-service.ts")).toContain("archiveAcademicYear");
    expect(await readSrc("src/lib/academic-years/academic-year-service.ts")).toContain("summarizeAcademicYears");
    expect(await readSrc("src/app/api/admin/academic-years/[id]/route.ts")).toContain('action === "archive"');
  });

  it("records partnership message audit trail", async () => {
    expect(await readSrc("src/models/PartnershipMessageAudit.ts")).toContain('"sent"');
    expect(await readSrc("src/app/api/admin/partnerships/messages/audit/route.ts")).toContain(
      "listPartnershipMessageAudit"
    );
  });
});
