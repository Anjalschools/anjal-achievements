import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  PARTNER_ORGANIZATION_CATEGORIES,
  type PartnerOrganizationCategory,
} from "@/lib/partnerships/institution-analytics-constants";

export interface IPartnerOrganization extends Document {
  name: string;
  logo?: string;
  sector?: string;
  city?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  category?: PartnerOrganizationCategory;
  subCategory?: string;
  averageRating?: number;
  ratingCount?: number;
  institutionUserId?: Types.ObjectId;
  institutionUserIds?: Types.ObjectId[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerOrganizationSchema = new Schema<IPartnerOrganization>(
  {
    name: { type: String, required: true, trim: true, maxlength: 300 },
    logo: { type: String, trim: true, maxlength: 2000000 },
    sector: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 120 },
    contactName: { type: String, trim: true, maxlength: 200 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 320 },
    contactPhone: { type: String, trim: true, maxlength: 40 },
    notes: { type: String, trim: true, maxlength: 8000 },
    category: { type: String, enum: PARTNER_ORGANIZATION_CATEGORIES, sparse: true, index: true },
    subCategory: { type: String, trim: true, maxlength: 200 },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    institutionUserId: { type: Schema.Types.ObjectId, ref: "User", sparse: true, unique: true, index: true },
    institutionUserIds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

PartnerOrganizationSchema.index({ name: 1, active: 1 });
PartnerOrganizationSchema.index({ city: 1, active: 1 });

const PartnerOrganization: Model<IPartnerOrganization> =
  mongoose.models.PartnerOrganization ||
  mongoose.model<IPartnerOrganization>("PartnerOrganization", PartnerOrganizationSchema);

export default PartnerOrganization;
