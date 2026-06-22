import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipMessage from "@/models/PartnershipMessage";
import type { PartnershipMessageType } from "@/models/PartnershipMessage";
import PartnershipMessageAudit from "@/models/PartnershipMessageAudit";
import PartnershipThread from "@/models/PartnershipThread";

export const PARTNERSHIP_MESSAGE_DELETE_UNDO_MS = 15 * 60 * 1000;

export const DELETED_MESSAGE_PLACEHOLDER_AR = "تم حذف هذه الرسالة";
export const DELETED_MESSAGE_PLACEHOLDER_EN = "This message was deleted";

/** Roles that may edit/delete/restore their own user messages (ownership required). */
export const PARTNERSHIP_MESSAGE_EDIT_ROLES = [
  "admin",
  "supervisor",
  "partnershipSupervisor",
  "schoolAdmin", // school partnership officer
  "teacher", // school training coordinator
] as const;

const PARTNERSHIP_MESSAGE_EDIT_ROLE_SET = new Set<string>(PARTNERSHIP_MESSAGE_EDIT_ROLES);

/** Roles that may delete/restore their own messages (includes portal participants). */
export const PARTNERSHIP_MESSAGE_DELETE_ROLES = [
  ...PARTNERSHIP_MESSAGE_EDIT_ROLES,
  "trainingInstitution",
  "student",
] as const;

const PARTNERSHIP_MESSAGE_DELETE_ROLE_SET = new Set<string>(PARTNERSHIP_MESSAGE_DELETE_ROLES);

/** @deprecated Use PARTNERSHIP_MESSAGE_EDIT_ROLES */
export const SUPERVISOR_EDIT_ROLES = PARTNERSHIP_MESSAGE_EDIT_ROLE_SET;

export const PARTNERSHIP_AUTOMATED_MESSAGE_KINDS = new Set(["institution_handoff"]);

export const normalizePartnershipSenderId = (senderId: unknown): string => {
  if (senderId == null) return "";
  if (typeof senderId === "string") return senderId.trim();
  if (senderId instanceof mongoose.Types.ObjectId) return senderId.toHexString();
  if (typeof senderId === "object") {
    const maybeObjectId = senderId as { toHexString?: () => string; toString?: () => string };
    if (typeof maybeObjectId.toHexString === "function") {
      return maybeObjectId.toHexString();
    }
    if ("$oid" in senderId) {
      return String((senderId as { $oid: unknown }).$oid).trim();
    }
    if ("_id" in senderId) {
      return normalizePartnershipSenderId((senderId as { _id: unknown })._id);
    }
    if (typeof maybeObjectId.toString === "function") {
      const value = maybeObjectId.toString();
      if (value && value !== "[object Object]") return value;
    }
  }
  return String(senderId).trim();
};

export const partnershipUserIdsMatch = (left: unknown, right: unknown): boolean => {
  const leftId = normalizePartnershipSenderId(left);
  const rightId = normalizePartnershipSenderId(right);
  if (!leftId || !rightId) return false;
  if (leftId === rightId) return true;
  if (mongoose.Types.ObjectId.isValid(leftId) && mongoose.Types.ObjectId.isValid(rightId)) {
    return new mongoose.Types.ObjectId(leftId).equals(new mongoose.Types.ObjectId(rightId));
  }
  return false;
};

export const resolvePartnershipActorId = (user: { _id?: unknown; id?: unknown }): string =>
  normalizePartnershipSenderId(user._id ?? user.id);

const isOwnMessage = (
  senderId: mongoose.Types.ObjectId | string | unknown,
  userId: mongoose.Types.ObjectId | string | unknown
): boolean => partnershipUserIdsMatch(senderId, userId);

const roleCanEditPartnershipMessage = (role: string): boolean =>
  PARTNERSHIP_MESSAGE_EDIT_ROLE_SET.has(String(role || "").trim());

const roleCanDeletePartnershipMessage = (role: string): boolean =>
  PARTNERSHIP_MESSAGE_DELETE_ROLE_SET.has(String(role || "").trim());

const resolvePartnershipTemplateKey = (row: {
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): string => {
  const meta = row.metadata || {};
  const fromMeta = typeof meta.templateKey === "string" ? meta.templateKey.trim() : "";
  const fromRow = typeof row.templateKey === "string" ? row.templateKey.trim() : "";
  return fromMeta || fromRow;
};

const isManualUserTemplateMessage = (row: {
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean => {
  const templateKey = resolvePartnershipTemplateKey(row);
  if (!templateKey) return false;
  const meta = row.metadata || {};
  if (typeof meta.kind === "string" && meta.kind.trim()) return false;
  return true;
};

export const isPartnershipSystemMessage = (row: {
  messageType?: string | null;
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean => {
  if (isManualUserTemplateMessage(row)) return false;

  const meta = row.metadata || {};

  if (typeof meta.kind === "string") {
    const kind = meta.kind.trim();
    if (kind && PARTNERSHIP_AUTOMATED_MESSAGE_KINDS.has(kind)) return true;
  }

  if (row.messageType === "system") return true;
  if (meta.automated === true) return true;
  return false;
};

export const resolvePartnershipMessageType = (row: {
  messageType?: string | null;
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): PartnershipMessageType => (isPartnershipSystemMessage(row) ? "system" : "user");

export const buildPartnershipMessagePermissionInput = (input: {
  role: string;
  senderId: string;
  userId: mongoose.Types.ObjectId;
  messageType?: PartnershipMessageType | string;
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}) => ({
  role: input.role,
  senderId: input.senderId,
  userId: input.userId,
  messageType: input.messageType,
  templateKey: input.templateKey,
  metadata: input.metadata,
});

export const canManageOwnPartnershipMessage = (input: {
  role: string;
  senderId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  messageType?: PartnershipMessageType | string;
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean => {
  if (isPartnershipSystemMessage(input)) return false;
  if (!isOwnMessage(input.senderId, input.userId)) return false;
  return PARTNERSHIP_MESSAGE_DELETE_ROLE_SET.has(String(input.role || ""));
};

export const canEditPartnershipMessage = (input: {
  role: string;
  senderId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  messageType?: PartnershipMessageType | string;
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean => {
  if (isPartnershipSystemMessage(input)) return false;
  if (!isOwnMessage(input.senderId, input.userId)) return false;
  return PARTNERSHIP_MESSAGE_EDIT_ROLE_SET.has(String(input.role || ""));
};

export const canDeletePartnershipMessage = (input: {
  role: string;
  senderId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
  messageType?: PartnershipMessageType | string;
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean => canManageOwnPartnershipMessage(input);

export const canRestorePartnershipMessage = (input: {
  isDeleted?: boolean;
  deletedAt?: Date | null;
  role?: string;
  senderId?: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string;
  messageType?: PartnershipMessageType | string;
  templateKey?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean => {
  if (!input.isDeleted || !input.deletedAt) return false;
  if (Date.now() - new Date(input.deletedAt).getTime() > PARTNERSHIP_MESSAGE_DELETE_UNDO_MS) {
    return false;
  }
  if (input.role && input.senderId && input.userId) {
    return canManageOwnPartnershipMessage({
      role: input.role,
      senderId: input.senderId,
      userId: input.userId,
      messageType: input.messageType,
      templateKey: input.templateKey,
      metadata: input.metadata,
    });
  }
  return true;
};

const recordMessageAudit = async (input: {
  messageId: mongoose.Types.ObjectId;
  threadId: mongoose.Types.ObjectId;
  action: "sent" | "edited" | "deleted" | "restored";
  actorId: mongoose.Types.ObjectId;
  actorRole: string;
  metadata?: Record<string, unknown>;
}) => {
  await PartnershipMessageAudit.create({
    messageId: input.messageId,
    threadId: input.threadId,
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    timestamp: new Date(),
    metadata: input.metadata,
  });
};

const assertThreadAccess = async (input: {
  threadId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: string;
}) => {
  const thread = await PartnershipThread.findById(input.threadId);
  if (!thread) throw new Error("Thread not found");

  const isSupervisor = [
    "admin",
    "partnershipSupervisor",
    "supervisor",
    "schoolAdmin",
    "teacher",
  ].includes(String(input.role || ""));
  const isInstitution = input.role === "trainingInstitution";
  const isStudent = String(thread.studentId) === String(input.userId);

  if (isSupervisor || isStudent) return thread;
  if (isInstitution) {
    const allowed = (thread.participantInstitutionUserIds || []).some(
      (id) => String(id) === String(input.userId)
    );
    if (allowed || input.role === "admin") return thread;
  }
  throw new Error("Forbidden");
};

export const serializePartnershipMessageRow = (
  row: {
    _id?: mongoose.Types.ObjectId;
    senderId?: mongoose.Types.ObjectId;
    senderRole?: string;
    messageType?: string;
    metadata?: Record<string, unknown>;
    body?: string;
    templateKey?: string;
    createdAt?: Date;
    editedAt?: Date;
    editedBy?: mongoose.Types.ObjectId;
    isEdited?: boolean;
    isDeleted?: boolean;
    deletedAt?: Date;
  },
  userId: mongoose.Types.ObjectId
) => {
  const isDeleted = row.isDeleted === true;
  const messageType = resolvePartnershipMessageType(row);
  const isSystem = messageType === "system";
  const restoreWindowOpen =
    isDeleted &&
    row.deletedAt &&
    Date.now() - new Date(row.deletedAt).getTime() <= PARTNERSHIP_MESSAGE_DELETE_UNDO_MS;
  const canRestore = !isSystem && restoreWindowOpen;

  return {
    id: String(row._id),
    senderId: normalizePartnershipSenderId(row.senderId),
    senderRole: row.senderRole,
    messageType,
    isSystem,
    body: isDeleted ? DELETED_MESSAGE_PLACEHOLDER_AR : String(row.body || ""),
    templateKey: row.templateKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    editedAt: row.editedAt ? new Date(row.editedAt).toISOString() : null,
    isEdited: row.isEdited === true,
    isDeleted,
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    canRestore,
    isMine: isOwnMessage(row.senderId, userId),
    canEdit: false,
    canDelete: false,
  };
};

export const enrichMessagePermissions = (
  row: ReturnType<typeof serializePartnershipMessageRow>,
  input: {
    role: string;
    senderId: string;
    userId: mongoose.Types.ObjectId;
    messageType?: PartnershipMessageType | string;
    templateKey?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) => {
  const owner = row.isMine === true;
  const role = String(input.role || "").trim();

  if (row.isSystem || !owner) {
    return { ...row, canEdit: false, canDelete: false, canRestore: false };
  }

  return {
    ...row,
    canEdit: !row.isDeleted && roleCanEditPartnershipMessage(role),
    canDelete: !row.isDeleted && roleCanDeletePartnershipMessage(role),
    canRestore:
      row.isDeleted &&
      row.canRestore === true &&
      roleCanDeletePartnershipMessage(role),
  };
};

const enrichInputFromMessageDoc = (
  message: {
    senderId: mongoose.Types.ObjectId;
    messageType?: string;
    templateKey?: string;
    metadata?: Record<string, unknown>;
  },
  userId: mongoose.Types.ObjectId,
  role: string
) => ({
  role,
  senderId: normalizePartnershipSenderId(message.senderId),
  userId,
  messageType: message.messageType,
  templateKey: message.templateKey,
  metadata: message.metadata,
});

export const editPartnershipMessage = async (input: {
  messageId: string;
  userId: mongoose.Types.ObjectId;
  role: string;
  body: string;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.messageId)) throw new Error("Invalid message id");

  const message = await PartnershipMessage.findById(input.messageId);
  if (!message) throw new Error("Message not found");
  if (isPartnershipSystemMessage(message.toObject())) throw new Error("System messages cannot be edited");
  if (message.isDeleted) throw new Error("Cannot edit a deleted message");

  if (
    !canEditPartnershipMessage(
      buildPartnershipMessagePermissionInput(enrichInputFromMessageDoc(message, input.userId, input.role))
    )
  ) {
    throw new Error("Forbidden");
  }

  await assertThreadAccess({
    threadId: message.threadId,
    userId: input.userId,
    role: input.role,
  });

  const nextBody = String(input.body || "").trim();
  if (!nextBody) throw new Error("Message body is required");
  if (nextBody === message.body) return serializePartnershipMessageRow(message.toObject(), input.userId);

  const history = Array.isArray(message.editHistory) ? [...message.editHistory] : [];
  history.push({
    previousContent: message.body,
    editedAt: new Date(),
    editedBy: input.userId,
  });

  message.body = nextBody;
  message.isEdited = true;
  message.editedAt = new Date();
  message.editedBy = input.userId;
  message.editHistory = history;
  await message.save();

  await recordMessageAudit({
    messageId: message._id,
    threadId: message.threadId,
    action: "edited",
    actorId: input.userId,
    actorRole: input.role,
    metadata: { previousLength: history[history.length - 1]?.previousContent?.length ?? 0 },
  });

  const thread = await PartnershipThread.findById(message.threadId);
  if (thread && String(thread.lastMessagePreview || "").slice(0, 50) === message.body.slice(0, 50)) {
    thread.lastMessagePreview = nextBody.slice(0, 280);
    await thread.save();
  }

  return enrichMessagePermissions(
    serializePartnershipMessageRow(message.toObject(), input.userId),
    enrichInputFromMessageDoc(message, input.userId, input.role)
  );
};

export const softDeletePartnershipMessage = async (input: {
  messageId: string;
  userId: mongoose.Types.ObjectId;
  role: string;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.messageId)) throw new Error("Invalid message id");

  const message = await PartnershipMessage.findById(input.messageId);
  if (!message) throw new Error("Message not found");
  if (message.isDeleted) {
    return enrichMessagePermissions(
      serializePartnershipMessageRow(message.toObject(), input.userId),
      enrichInputFromMessageDoc(message, input.userId, input.role)
    );
  }
  if (isPartnershipSystemMessage(message.toObject())) throw new Error("System messages cannot be deleted");

  if (
    !canDeletePartnershipMessage(
      buildPartnershipMessagePermissionInput(enrichInputFromMessageDoc(message, input.userId, input.role))
    )
  ) {
    throw new Error("Forbidden");
  }

  await assertThreadAccess({
    threadId: message.threadId,
    userId: input.userId,
    role: input.role,
  });

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = input.userId;
  await message.save();

  await recordMessageAudit({
    messageId: message._id,
    threadId: message.threadId,
    action: "deleted",
    actorId: input.userId,
    actorRole: input.role,
  });

  return enrichMessagePermissions(
    serializePartnershipMessageRow(message.toObject(), input.userId),
    enrichInputFromMessageDoc(message, input.userId, input.role)
  );
};

export const restorePartnershipMessage = async (input: {
  messageId: string;
  userId: mongoose.Types.ObjectId;
  role: string;
}) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(input.messageId)) throw new Error("Invalid message id");

  const message = await PartnershipMessage.findById(input.messageId);
  if (!message) throw new Error("Message not found");
  if (!message.isDeleted) throw new Error("Message is not deleted");
  if (isPartnershipSystemMessage(message.toObject())) throw new Error("System messages cannot be restored");
  const permissionInput = buildPartnershipMessagePermissionInput(
    enrichInputFromMessageDoc(message, input.userId, input.role)
  );
  if (
    !canRestorePartnershipMessage({
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      role: input.role,
      senderId: message.senderId,
      userId: input.userId,
      messageType: message.messageType,
      templateKey: message.templateKey,
      metadata: message.metadata,
    })
  ) {
    throw new Error("Restore window expired");
  }

  if (!canDeletePartnershipMessage(permissionInput)) {
    throw new Error("Forbidden");
  }

  await assertThreadAccess({
    threadId: message.threadId,
    userId: input.userId,
    role: input.role,
  });

  message.isDeleted = false;
  message.deletedAt = undefined;
  message.deletedBy = undefined;
  await message.save();

  await recordMessageAudit({
    messageId: message._id,
    threadId: message.threadId,
    action: "restored",
    actorId: input.userId,
    actorRole: input.role,
  });

  return enrichMessagePermissions(
    serializePartnershipMessageRow(message.toObject(), input.userId),
    enrichInputFromMessageDoc(message, input.userId, input.role)
  );
};

export const recordPartnershipMessageSent = async (input: {
  messageId: mongoose.Types.ObjectId;
  threadId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorRole: string;
  metadata?: Record<string, unknown>;
}) => {
  await connectDB();
  await recordMessageAudit({
    messageId: input.messageId,
    threadId: input.threadId,
    action: "sent",
    actorId: input.actorId,
    actorRole: input.actorRole,
    metadata: input.metadata,
  });
};

export const listPartnershipMessageAudit = async (input: {
  threadId?: string;
  messageId?: string;
  limit?: number;
}) => {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (input.threadId && mongoose.Types.ObjectId.isValid(input.threadId)) {
    filter.threadId = new mongoose.Types.ObjectId(input.threadId);
  }
  if (input.messageId && mongoose.Types.ObjectId.isValid(input.messageId)) {
    filter.messageId = new mongoose.Types.ObjectId(input.messageId);
  }

  const rows = await PartnershipMessageAudit.find(filter)
    .sort({ timestamp: -1 })
    .limit(input.limit ?? 100)
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    messageId: String(row.messageId),
    threadId: String(row.threadId),
    action: row.action,
    actorId: String(row.actorId),
    actorRole: row.actorRole,
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : null,
    metadata: row.metadata || null,
  }));
};
