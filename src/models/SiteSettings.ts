import mongoose, { Schema, type Model, type Document } from "mongoose";

export interface IHomeCeremonySection {
  titleAr?: string;
  titleEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  invitationTextAr?: string;
  invitationTextEn?: string;
}

export interface ISiteSettings extends Document {
  key: string;
  homeCeremonySection: IHomeCeremonySection;
  homePageContent?: Record<string, string | string[]>;
  createdAt: Date;
  updatedAt: Date;
}

const HomeCeremonySchema = new Schema<IHomeCeremonySection>(
  {
    titleAr: { type: String, default: "" },
    titleEn: { type: String, default: "" },
    subtitleAr: { type: String, default: "" },
    subtitleEn: { type: String, default: "" },
    descriptionAr: { type: String, default: "" },
    descriptionEn: { type: String, default: "" },
    invitationTextAr: { type: String, default: "" },
    invitationTextEn: { type: String, default: "" },
  },
  { _id: false }
);

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    key: { type: String, unique: true, default: "main" },
    homeCeremonySection: {
      type: HomeCeremonySchema,
      default: () => ({}),
    },
    homePageContent: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const SiteSettings: Model<ISiteSettings> =
  mongoose.models.SiteSettings || mongoose.model<ISiteSettings>("SiteSettings", SiteSettingsSchema);

export default SiteSettings;
