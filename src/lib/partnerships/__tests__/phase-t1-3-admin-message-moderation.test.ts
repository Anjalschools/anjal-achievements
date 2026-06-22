import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

import mongoose from "mongoose";
import {
  canDeletePartnershipMessage,
  canEditPartnershipMessage,
  canRestorePartnershipMessage,
  enrichMessagePermissions,
  isPartnershipAdminMessageModerator,
  isPartnershipSystemMessage,
  serializePartnershipMessageRow,
} from "@/lib/partnerships/partnership-message-mutation-service";

describe("Phase T.1.3 admin global message moderation", () => {
  const adminId = "507f1f77bcf86cd799439011";
  const otherId = "507f1f77bcf86cd799439012";
  const userObjectId = new mongoose.Types.ObjectId(adminId);
  const otherObjectId = new mongoose.Types.ObjectId(otherId);

  it("enables admin override only for admin role", () => {
    expect(isPartnershipAdminMessageModerator("admin")).toBe(true);
    expect(isPartnershipAdminMessageModerator("partnershipSupervisor")).toBe(false);
    expect(isPartnershipAdminMessageModerator("schoolAdmin")).toBe(false);
  });

  it("allows admin to moderate any user message", () => {
    const permission = {
      role: "admin",
      senderId: otherId,
      userId: adminId,
      messageType: "user" as const,
    };
    expect(canEditPartnershipMessage(permission)).toBe(true);
    expect(canDeletePartnershipMessage(permission)).toBe(true);
  });

  it("keeps ownership requirement for partnership supervisor on other messages", () => {
    const otherMessage = {
      role: "partnershipSupervisor",
      senderId: otherId,
      userId: adminId,
      messageType: "user" as const,
    };
    const ownMessage = {
      role: "partnershipSupervisor",
      senderId: adminId,
      userId: adminId,
      messageType: "user" as const,
    };
    expect(canEditPartnershipMessage(otherMessage)).toBe(false);
    expect(canDeletePartnershipMessage(otherMessage)).toBe(false);
    expect(canEditPartnershipMessage(ownMessage)).toBe(true);
    expect(canDeletePartnershipMessage(ownMessage)).toBe(true);
  });

  it("keeps ownership requirement for school partnership staff", () => {
    for (const role of ["schoolAdmin", "teacher"] as const) {
      expect(canEditPartnershipMessage({ role, senderId: otherId, userId: adminId })).toBe(false);
      expect(canEditPartnershipMessage({ role, senderId: adminId, userId: adminId })).toBe(true);
    }
  });

  it("blocks all roles from system messages including admin", () => {
    const systemRow = { messageType: "system" as const, metadata: { kind: "institution_handoff" } };
    expect(isPartnershipSystemMessage(systemRow)).toBe(true);
    expect(
      canEditPartnershipMessage({ role: "admin", senderId: otherId, userId: adminId, ...systemRow })
    ).toBe(false);
    expect(
      canDeletePartnershipMessage({ role: "admin", senderId: otherId, userId: adminId, ...systemRow })
    ).toBe(false);
  });

  it("reflects admin override in serialized thread permissions", () => {
    const row = {
      _id: new mongoose.Types.ObjectId(),
      senderId: otherObjectId,
      senderRole: "supervisor",
      messageType: "user",
      body: "رسالة مستخدم",
      createdAt: new Date(),
    };
    const serialized = serializePartnershipMessageRow(row, userObjectId);
    expect(serialized.isMine).toBe(false);

    const enriched = enrichMessagePermissions(serialized, {
      role: "admin",
      senderId: otherId,
      userId: userObjectId,
      messageType: row.messageType,
    });

    expect(enriched.canEdit).toBe(true);
    expect(enriched.canDelete).toBe(true);
    expect(enriched.canRestore).toBe(false);
  });

  it("allows admin to restore another user's deleted message inside undo window", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000);
    expect(
      canRestorePartnershipMessage({
        isDeleted: true,
        deletedAt: recent,
        role: "admin",
        senderId: otherId,
        userId: adminId,
        messageType: "user",
      })
    ).toBe(true);
    expect(
      canRestorePartnershipMessage({
        isDeleted: true,
        deletedAt: recent,
        role: "partnershipSupervisor",
        senderId: otherId,
        userId: adminId,
        messageType: "user",
      })
    ).toBe(false);
  });
});
