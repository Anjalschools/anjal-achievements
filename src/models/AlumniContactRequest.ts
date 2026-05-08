import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAlumniContactRequest extends Document {
  requesterUserId?: Types.ObjectId;
  requesterName: string;
  requesterEmail: string;
  message?: string;
  targetType: "mentor" | "opportunity";
  targetId: string;
  status: "new" | "reviewed";
  createdAt: Date;
  updatedAt: Date;
}

const AlumniContactRequestSchema = new Schema<IAlumniContactRequest>(
  {
    requesterUserId: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    requesterName: { type: String, required: true, trim: true, maxlength: 200 },
    requesterEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    message: { type: String, trim: true, maxlength: 4000 },
    targetType: { type: String, enum: ["mentor", "opportunity"], required: true, index: true },
    targetId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    status: { type: String, enum: ["new", "reviewed"], default: "new", index: true },
  },
  { timestamps: true }
);

AlumniContactRequestSchema.index({ requesterEmail: 1, createdAt: -1 });

const AlumniContactRequest: Model<IAlumniContactRequest> =
  mongoose.models.AlumniContactRequest ||
  mongoose.model<IAlumniContactRequest>("AlumniContactRequest", AlumniContactRequestSchema);

export default AlumniContactRequest;
