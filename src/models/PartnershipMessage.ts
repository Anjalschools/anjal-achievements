import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { PARTNERSHIP_MESSAGE_TEMPLATES } from "@/lib/partnerships/partnerships-messaging-constants";

export type PartnershipMessageEditHistoryEntry = {
  previousContent: string;
  editedAt: Date;
  editedBy: Types.ObjectId;
};

export type PartnershipMessageType = "user" | "system";

export interface IPartnershipMessage extends Document {
  threadId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: "student" | "supervisor" | "institution";
  messageType?: PartnershipMessageType;
  body: string;
  templateKey?: (typeof PARTNERSHIP_MESSAGE_TEMPLATES)[number];
  metadata?: Record<string, unknown>;
  editedAt?: Date;
  editedBy?: Types.ObjectId;
  isEdited?: boolean;
  editHistory?: PartnershipMessageEditHistoryEntry[];
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EditHistorySchema = new Schema<PartnershipMessageEditHistoryEntry>(
  {
    previousContent: { type: String, required: true, maxlength: 8000 },
    editedAt: { type: Date, required: true },
    editedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const PartnershipMessageSchema = new Schema<IPartnershipMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "PartnershipThread", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderRole: { type: String, enum: ["student", "supervisor", "institution"], required: true, index: true },
    messageType: { type: String, enum: ["user", "system"], default: "user", index: true },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    templateKey: { type: String, enum: PARTNERSHIP_MESSAGE_TEMPLATES, sparse: true, index: true },
    metadata: { type: Schema.Types.Mixed },
    editedAt: { type: Date },
    editedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isEdited: { type: Boolean, default: false },
    editHistory: { type: [EditHistorySchema], default: undefined },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PartnershipMessageSchema.index({ threadId: 1, createdAt: 1 });

const PartnershipMessage: Model<IPartnershipMessage> =
  mongoose.models.PartnershipMessage ||
  mongoose.model<IPartnershipMessage>("PartnershipMessage", PartnershipMessageSchema);

export default PartnershipMessage;
