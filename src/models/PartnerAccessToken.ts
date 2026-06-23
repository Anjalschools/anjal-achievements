import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPartnerAccessToken extends Document {
  organizationId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerAccessTokenSchema = new Schema<IPartnerAccessToken>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true },
    token: { type: String, required: true, unique: true, trim: true, maxlength: 200 },
    expiresAt: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PartnerAccessTokenSchema.index({ organizationId: 1, active: 1, expiresAt: -1 });

const PartnerAccessToken: Model<IPartnerAccessToken> =
  mongoose.models.PartnerAccessToken ||
  mongoose.model<IPartnerAccessToken>("PartnerAccessToken", PartnerAccessTokenSchema);

export default PartnerAccessToken;
