import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniFeedEngagementAction = "like" | "save" | "share";

export interface IAlumniFeedEngagement extends Document {
  actorId: Types.ObjectId;
  targetKind: string;
  targetId: string;
  targetOwnerId: Types.ObjectId;
  action: AlumniFeedEngagementAction;
  createdAt: Date;
}

const AlumniFeedEngagementSchema = new Schema<IAlumniFeedEngagement>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetKind: { type: String, required: true, trim: true, maxlength: 32, index: true },
    targetId: { type: String, required: true, trim: true, maxlength: 80, index: true },
    targetOwnerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: ["like", "save", "share"], required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AlumniFeedEngagementSchema.index({ targetKind: 1, targetId: 1, action: 1 });
AlumniFeedEngagementSchema.index(
  { actorId: 1, targetKind: 1, targetId: 1, action: 1 },
  { unique: true, partialFilterExpression: { action: { $in: ["like", "save"] } } }
);

const AlumniFeedEngagement: Model<IAlumniFeedEngagement> =
  mongoose.models.AlumniFeedEngagement ||
  mongoose.model<IAlumniFeedEngagement>("AlumniFeedEngagement", AlumniFeedEngagementSchema);

export default AlumniFeedEngagement;
