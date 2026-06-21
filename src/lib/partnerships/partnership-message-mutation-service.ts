import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipMessageAudit from "@/models/PartnershipMessageAudit";
import PartnershipThread from "@/models/PartnershipThread";

export const PARTNERSHIP_MESSAGE_DELETE_UNDO_MS = 15 * 60 * 1000;

export const DELETED_MESSAGE_PLACEHOLDER_AR = "تم حذف هذه الرسالة";
export const DELETED_MESSAGE_PLACEHOLDER_EN = "This message was deleted";

const SUPERVISOR_EDIT_ROLES = new Set(["admin", "supervisor", "partnershipSupervisor"]);

export const canEditPartnershipMessage = (input: {
  role: string;
  senderId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
}): boolean =>
  SUPERVISOR_EDIT_ROLES.has(String(input.role || "")) &&
  String(input.senderId) === String(input.userId);

export const canDeletePartnershipMessage = (input: {
  role: string;
  senderId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId | string;
}): boolean => {
  if (String(input.senderId) !== String(input.userId)) return false;
  const role = String(input.role || "");
  if (SUPERVISOR_EDIT_ROLES.has(role)) return true;
  if (role === "trainingInstitution") return true;
  if (role === "student") return true;
  return false;
};

export const canRestorePartnershipMessage = (message: {
  isDeleted?: boolean;
  deletedAt?: Date | null;
}): boolean => {
  if (!message.isDeleted || !message.deletedAt) return false;
  return Date.now() - new Date(message.deletedAt).getTime() <= PARTNERSHIP_MESSAGE_DELETE_UNDO_MS;
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

  const isSupervisor = ["admin", "partnershipSupervisor", "supervisor", "schoolAdmin"].includes(
    String(input.role || "")
  );
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
  const canRestore = canRestorePartnershipMessage({
    isDeleted,
    deletedAt: row.deletedAt,
  });

  return {
    id: String(row._id),
    senderRole: row.senderRole,
    body: isDeleted ? DELETED_MESSAGE_PLACEHOLDER_AR : String(row.body || ""),
    templateKey: row.templateKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    editedAt: row.editedAt ? new Date(row.editedAt).toISOString() : null,
    isEdited: row.isEdited === true,
    isDeleted,
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
    canRestore,
    isMine: String(row.senderId) === String(userId),
    canEdit: false,
    canDelete: false,
  };
};

export const enrichMessagePermissions = (
  row: ReturnType<typeof serializePartnershipMessageRow>,
  input: { role: string; senderId: string; userId: mongoose.Types.ObjectId }
) => ({
  ...row,
  canEdit:
    !row.isDeleted &&
    canEditPartnershipMessage({
      role: input.role,
      senderId: input.senderId,
      userId: input.userId,
    }),
  canDelete:
    !row.isDeleted &&
    canDeletePartnershipMessage({
      role: input.role,
      senderId: input.senderId,
      userId: input.userId,
    }),
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
  if (message.isDeleted) throw new Error("Cannot edit a deleted message");

  if (
    !canEditPartnershipMessage({
      role: input.role,
      senderId: message.senderId,
      userId: input.userId,
    })
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
    { role: input.role, senderId: String(message.senderId), userId: input.userId }
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
      { role: input.role, senderId: String(message.senderId), userId: input.userId }
    );
  }

  if (
    !canDeletePartnershipMessage({
      role: input.role,
      senderId: message.senderId,
      userId: input.userId,
    })
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
    { role: input.role, senderId: String(message.senderId), userId: input.userId }
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
  if (!canRestorePartnershipMessage(message.toObject())) throw new Error("Restore window expired");

  if (
    !canDeletePartnershipMessage({
      role: input.role,
      senderId: message.senderId,
      userId: input.userId,
    })
  ) {
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
    { role: input.role, senderId: String(message.senderId), userId: input.userId }
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
