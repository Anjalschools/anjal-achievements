import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type PartnershipMessageAuditAction =
  | "sent"
  | "edited"
  | "deleted"
  | "restored";

export interface IPartnershipMessageAudit extends Document {
  messageId: Types.ObjectId;
  threadId: Types.ObjectId;
  action: PartnershipMessageAuditAction;
  actorId: Types.ObjectId;
  actorRole: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const PartnershipMessageAuditSchema = new Schema<IPartnershipMessageAudit>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "PartnershipMessage", required: true, index: true },
    threadId: { type: Schema.Types.ObjectId, ref: "PartnershipThread", required: true },
    action: {
      type: String,
      enum: ["sent", "edited", "deleted", "restored"],
      required: true,
      index: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: false }
);

PartnershipMessageAuditSchema.index({ threadId: 1, timestamp: -1 });

const PartnershipMessageAudit: Model<IPartnershipMessageAudit> =
  mongoose.models.PartnershipMessageAudit ||
  mongoose.model<IPartnershipMessageAudit>("PartnershipMessageAudit", PartnershipMessageAuditSchema);

export default PartnershipMessageAudit;
