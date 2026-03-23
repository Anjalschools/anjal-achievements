import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserConsent extends Document {
  userId: mongoose.Types.ObjectId;
  acceptedTerms: boolean;
  acceptedNotifications: boolean;
  acceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserConsentSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    acceptedTerms: {
      type: Boolean,
      required: true,
    },
    acceptedNotifications: {
      type: Boolean,
      default: false,
    },
    acceptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const UserConsent: Model<IUserConsent> =
  mongoose.models.UserConsent ||
  mongoose.model<IUserConsent>("UserConsent", UserConsentSchema);

export default UserConsent;
