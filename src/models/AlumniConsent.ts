import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAlumniConsent extends Document {
  userId: Types.ObjectId;
  campaignsEmail: boolean;
  systemNotifications: boolean;
  mentorshipNotifications: boolean;
  analyticsParticipation: boolean;
  updatedAt: Date;
  createdAt: Date;
}

const AlumniConsentSchema = new Schema<IAlumniConsent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    campaignsEmail: { type: Boolean, default: true },
    systemNotifications: { type: Boolean, default: true },
    mentorshipNotifications: { type: Boolean, default: true },
    analyticsParticipation: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const AlumniConsent: Model<IAlumniConsent> =
  mongoose.models.AlumniConsent || mongoose.model<IAlumniConsent>("AlumniConsent", AlumniConsentSchema);

export default AlumniConsent;
