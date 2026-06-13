import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { PARTNERSHIP_MESSAGE_TEMPLATES } from "@/lib/partnerships/partnerships-messaging-constants";

export interface IPartnershipMessage extends Document {
  threadId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: "student" | "supervisor" | "institution";
  body: string;
  templateKey?: (typeof PARTNERSHIP_MESSAGE_TEMPLATES)[number];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PartnershipMessageSchema = new Schema<IPartnershipMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "PartnershipThread", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderRole: { type: String, enum: ["student", "supervisor", "institution"], required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    templateKey: { type: String, enum: PARTNERSHIP_MESSAGE_TEMPLATES, sparse: true, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

PartnershipMessageSchema.index({ threadId: 1, createdAt: 1 });

const PartnershipMessage: Model<IPartnershipMessage> =
  mongoose.models.PartnershipMessage ||
  mongoose.model<IPartnershipMessage>("PartnershipMessage", PartnershipMessageSchema);

export default PartnershipMessage;
