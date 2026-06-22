/** T.1.2.F.0 decision matrix case numbers. */
export type PartnershipMessagePermissionCase = 1 | 2 | 3 | 4;

/** Network-tab verification row for T.1.2.F.0 API-first checks. */
export type PartnershipMessagePermissionTraceRow = {
  id: string;
  senderId: string;
  currentUserId: string;
  isMine: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  messageType: string;
  templateKey: string | null;
  permissionCase: PartnershipMessagePermissionCase;
};

export const PARTNERSHIP_MESSAGE_PERMISSION_CASE_GUIDANCE: Record<
  PartnershipMessagePermissionCase,
  { result: string; action: string }
> = {
  1: {
    result: "Backend permissions confirmed healthy",
    action: "Do NOT modify permission code. Investigate UI only.",
  },
  2: {
    result: "Permission enrichment still failing",
    action:
      "Investigate enrichMessagePermissions(), isPartnershipSystemMessage(), messageType normalization",
  },
  3: {
    result: "Ownership mismatch",
    action: "Investigate senderId, currentUserId, serialization path. Do not touch UI yet.",
  },
  4: {
    result: "Thread loading issue",
    action: "Investigate query layer. Message missing from API payload.",
  },
};

export const classifyPartnershipMessagePermissionCase = (input: {
  foundInPayload: boolean;
  isMine?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}): PartnershipMessagePermissionCase => {
  if (!input.foundInPayload) return 4;
  if (input.isMine !== true) return 3;
  if (input.canEdit === true && input.canDelete === true) return 1;
  return 2;
};

export const buildPartnershipMessagePermissionTraceRow = (
  message: {
    id: string;
    senderId?: string;
    isMine?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canRestore?: boolean;
    messageType?: string;
    templateKey?: string | null;
  },
  currentUserId: string
): PartnershipMessagePermissionTraceRow => ({
  id: message.id,
  senderId: message.senderId ?? "",
  currentUserId,
  isMine: message.isMine === true,
  canEdit: message.canEdit === true,
  canDelete: message.canDelete === true,
  canRestore: message.canRestore === true,
  messageType: message.messageType ?? "user",
  templateKey: message.templateKey ?? null,
  permissionCase: classifyPartnershipMessagePermissionCase({
    foundInPayload: true,
    isMine: message.isMine,
    canEdit: message.canEdit,
    canDelete: message.canDelete,
  }),
});
