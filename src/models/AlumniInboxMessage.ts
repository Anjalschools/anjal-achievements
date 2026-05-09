import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAlumniInboxMessage extends Document {
  threadId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  /** Soft delete — hide from UI without destroying audit trail. */
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniInboxMessageSchema = new Schema<IAlumniInboxMessage>(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "AlumniInboxThread", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

AlumniInboxMessageSchema.index({ threadId: 1, createdAt: 1 });

const AlumniInboxMessage: Model<IAlumniInboxMessage> =
  mongoose.models.AlumniInboxMessage ||
  mongoose.model<IAlumniInboxMessage>("AlumniInboxMessage", AlumniInboxMessageSchema);

export default AlumniInboxMessage;
