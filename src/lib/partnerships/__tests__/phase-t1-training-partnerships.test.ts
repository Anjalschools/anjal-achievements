import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

import {
  canDeletePartnershipMessage,
  canEditPartnershipMessage,
  canRestorePartnershipMessage,
  DELETED_MESSAGE_PLACEHOLDER_AR,
  isPartnershipSystemMessage,
  PARTNERSHIP_MESSAGE_DELETE_UNDO_MS,
} from "@/lib/partnerships/partnership-message-mutation-service";
import { isPartnershipSupervisorAllowedAdminPath } from "@/lib/achievement-reviewer-roles";

describe("partnership message mutation permissions", () => {
  const userId = "507f1f77bcf86cd799439011";
  const otherId = "507f1f77bcf86cd799439012";

  it("allows supervisor roles to edit own messages only", () => {
    expect(canEditPartnershipMessage({ role: "admin", senderId: userId, userId })).toBe(true);
    expect(canEditPartnershipMessage({ role: "partnershipSupervisor", senderId: userId, userId })).toBe(
      true
    );
    expect(canEditPartnershipMessage({ role: "supervisor", senderId: userId, userId })).toBe(true);
    expect(canEditPartnershipMessage({ role: "admin", senderId: otherId, userId })).toBe(false);
    expect(canEditPartnershipMessage({ role: "trainingInstitution", senderId: userId, userId })).toBe(
      false
    );
    expect(canEditPartnershipMessage({ role: "student", senderId: userId, userId })).toBe(false);
  });

  it("allows school partnership staff to manage own user messages only", () => {
    expect(canEditPartnershipMessage({ role: "schoolAdmin", senderId: userId, userId })).toBe(true);
    expect(canEditPartnershipMessage({ role: "teacher", senderId: userId, userId })).toBe(true);
    expect(canEditPartnershipMessage({ role: "schoolAdmin", senderId: otherId, userId })).toBe(false);
    expect(canEditPartnershipMessage({ role: "teacher", senderId: otherId, userId })).toBe(false);
    expect(canDeletePartnershipMessage({ role: "schoolAdmin", senderId: userId, userId })).toBe(true);
    expect(canDeletePartnershipMessage({ role: "teacher", senderId: userId, userId })).toBe(true);
    expect(canDeletePartnershipMessage({ role: "schoolAdmin", senderId: otherId, userId })).toBe(false);
  });

  it("allows owners in supported roles to delete messages", () => {
    expect(canDeletePartnershipMessage({ role: "student", senderId: userId, userId })).toBe(true);
    expect(canDeletePartnershipMessage({ role: "trainingInstitution", senderId: userId, userId })).toBe(
      true
    );
    expect(canDeletePartnershipMessage({ role: "student", senderId: otherId, userId })).toBe(false);
  });

  it("allows restore only inside the undo window and for message owners", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000);
    const expired = new Date(Date.now() - PARTNERSHIP_MESSAGE_DELETE_UNDO_MS - 1000);
    expect(canRestorePartnershipMessage({ isDeleted: true, deletedAt: recent })).toBe(true);
    expect(canRestorePartnershipMessage({ isDeleted: true, deletedAt: expired })).toBe(false);
    expect(canRestorePartnershipMessage({ isDeleted: false, deletedAt: recent })).toBe(false);
    expect(
      canRestorePartnershipMessage({
        isDeleted: true,
        deletedAt: recent,
        role: "schoolAdmin",
        senderId: userId,
        userId,
      })
    ).toBe(true);
    expect(
      canRestorePartnershipMessage({
        isDeleted: true,
        deletedAt: recent,
        role: "schoolAdmin",
        senderId: otherId,
        userId,
      })
    ).toBe(false);
  });

  it("uses Arabic deleted placeholder constant", () => {
    expect(DELETED_MESSAGE_PLACEHOLDER_AR).toBe("تم حذف هذه الرسالة");
  });

  it("blocks edit/delete/restore on system messages", () => {
    const userId = "507f1f77bcf86cd799439011";
    const systemRow = { messageType: "system" as const, metadata: { automated: true } };
    expect(canEditPartnershipMessage({ role: "admin", senderId: userId, userId, ...systemRow })).toBe(
      false
    );
    expect(canDeletePartnershipMessage({ role: "admin", senderId: userId, userId, ...systemRow })).toBe(
      false
    );
    expect(isPartnershipSystemMessage({ messageType: "system" })).toBe(true);
    expect(isPartnershipSystemMessage({ metadata: { kind: "institution_handoff" } })).toBe(true);
  });

  it("treats manual template sends as user messages (not system)", () => {
    const userId = "507f1f77bcf86cd799439011";
    const legacyTemplateRow = {
      messageType: "system" as const,
      metadata: { templateKey: "interview_invite", automated: true },
    };
    const newTemplateRow = {
      messageType: "user" as const,
      metadata: { templateKey: "interview_invite", source: "manual_template" },
    };
    expect(isPartnershipSystemMessage(legacyTemplateRow)).toBe(false);
    expect(isPartnershipSystemMessage(newTemplateRow)).toBe(false);
    expect(canEditPartnershipMessage({ role: "admin", senderId: userId, userId, ...legacyTemplateRow })).toBe(
      true
    );
    expect(canEditPartnershipMessage({ role: "partnershipSupervisor", senderId: userId, userId, ...newTemplateRow })).toBe(
      true
    );
  });
});

describe("partnership supervisor admin navigation", () => {
  it("allows academic years and partnerships admin paths", () => {
    expect(isPartnershipSupervisorAllowedAdminPath("/admin/partnerships")).toBe(true);
    expect(isPartnershipSupervisorAllowedAdminPath("/admin/partnerships/applications")).toBe(true);
    expect(isPartnershipSupervisorAllowedAdminPath("/admin/academic-years")).toBe(true);
    expect(isPartnershipSupervisorAllowedAdminPath("/admin/dashboard")).toBe(false);
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
    expect(src).toContain("getGradeLabel");
    expect(src).toContain("المسار");
    expect(src).toContain("wrapCellLines");
    expect(await readSrc("src/app/api/training/reports/approved-students/route.ts")).toContain(
      "buildApprovedStudentsPdf"
    );
  });

  it("supports academic year archive and dashboard summary", async () => {
    expect(await readSrc("src/lib/academic-years/academic-year-service.ts")).toContain("archiveAcademicYear");
    expect(await readSrc("src/lib/academic-years/academic-year-service.ts")).toContain("summarizeAcademicYears");
    expect(await readSrc("src/app/api/admin/academic-years/[id]/route.ts")).toContain('action === "archive"');
    const pageSrc = await readSrc("src/app/(app)/admin/academic-years/page.tsx");
    expect(pageSrc).toContain("window.confirm");
    expect(pageSrc).toContain("renderStatusBadges");
  });

  it("records partnership message audit trail", async () => {
    expect(await readSrc("src/models/PartnershipMessageAudit.ts")).toContain('"sent"');
    expect(await readSrc("src/app/api/admin/partnerships/messages/audit/route.ts")).toContain(
      "listPartnershipMessageAudit"
    );
  });
});
