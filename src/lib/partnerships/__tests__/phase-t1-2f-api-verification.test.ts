import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

import {
  buildPartnershipMessagePermissionTraceRow,
  classifyPartnershipMessagePermissionCase,
  PARTNERSHIP_MESSAGE_PERMISSION_CASE_GUIDANCE,
} from "@/lib/partnerships/partnership-message-permission-trace";
import {
  enrichMessagePermissions,
  serializePartnershipMessageRow,
} from "@/lib/partnerships/partnership-message-mutation-service";
import mongoose from "mongoose";

describe("Phase T.1.2.F.0 API permission decision matrix", () => {
  const currentUserId = "507f1f77bcf86cd799439011";

  it("Case 1 — healthy backend permissions for owned messages", () => {
    const row = buildPartnershipMessagePermissionTraceRow(
      {
        id: "msg-1",
        senderId: currentUserId,
        isMine: true,
        canEdit: true,
        canDelete: true,
        canRestore: false,
        messageType: "user",
        templateKey: "interview_invite",
      },
      currentUserId
    );

    expect(row.permissionCase).toBe(1);
    expect(row).toMatchObject({
      id: "msg-1",
      senderId: currentUserId,
      currentUserId,
      isMine: true,
      canEdit: true,
      canDelete: true,
      messageType: "user",
      templateKey: "interview_invite",
    });
    expect(PARTNERSHIP_MESSAGE_PERMISSION_CASE_GUIDANCE[1].action).toContain("UI only");
  });

  it("Case 2 — owned message but permissions false", () => {
    expect(
      classifyPartnershipMessagePermissionCase({
        foundInPayload: true,
        isMine: true,
        canEdit: false,
        canDelete: false,
      })
    ).toBe(2);
  });

  it("Case 3 — ownership mismatch", () => {
    const row = buildPartnershipMessagePermissionTraceRow(
      {
        id: "msg-2",
        senderId: "507f1f77bcf86cd799439012",
        isMine: false,
        canEdit: false,
        canDelete: false,
        messageType: "user",
      },
      currentUserId
    );

    expect(row.permissionCase).toBe(3);
    expect(row.senderId).not.toBe(row.currentUserId);
  });

  it("Case 4 — message missing from payload", () => {
    expect(
      classifyPartnershipMessagePermissionCase({
        foundInPayload: false,
      })
    ).toBe(4);
  });

  it("full serialize+enrich pipeline predicts Case 1 for owned schoolAdmin template message", () => {
    const userId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
    const row = {
      _id: new mongoose.Types.ObjectId(),
      senderId: userId,
      senderRole: "supervisor",
      messageType: "system",
      templateKey: "interview_invite",
      metadata: { automated: true },
      body: "رسالة اختبار",
      createdAt: new Date(),
    };
    const currentUserId = String(userId);
    const enriched = {
      ...enrichMessagePermissions(serializePartnershipMessageRow(row, userId), {
        role: "schoolAdmin",
        senderId: currentUserId,
        userId,
        messageType: row.messageType,
        templateKey: row.templateKey,
        metadata: row.metadata,
      }),
      currentUserId,
    };

    const trace = buildPartnershipMessagePermissionTraceRow(enriched, currentUserId);
    expect(trace.permissionCase).toBe(1);
    expect(trace).toMatchObject({
      senderId: currentUserId,
      currentUserId,
      isMine: true,
      canEdit: true,
      canDelete: true,
      messageType: "user",
      templateKey: "interview_invite",
    });
  });
});
