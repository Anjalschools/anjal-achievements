import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  descriptionAr?: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorName: { type: String, trim: true },
    actorEmail: { type: String, trim: true },
    actorRole: { type: String, trim: true, index: true },
    actionType: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, trim: true, index: true },
    entityId: { type: String, trim: true, index: true },
    entityTitle: { type: String, trim: true },
    descriptionAr: { type: String, trim: true, maxlength: 8000 },
    metadata: { type: Schema.Types.Mixed },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actionType: 1, createdAt: -1 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
