import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IPasswordResetToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Password reset tokens: store SHA-256 hex of raw token only. Expiry is enforced in application code.
 *
 * **Do not use a MongoDB TTL index on `expiresAt` here:** if the MongoDB cluster clock runs ahead of
 * the app server, TTL can delete rows immediately after insert, so `findOne({ tokenHash })` fails
 * even though the user still has a valid link. Clean up old rows via a periodic job if needed.
 */
const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const PasswordResetToken: Model<IPasswordResetToken> =
  mongoose.models.PasswordResetToken ||
  mongoose.model<IPasswordResetToken>("PasswordResetToken", PasswordResetTokenSchema);

export default PasswordResetToken;
