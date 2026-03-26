import mongoose, { Document, Model, Schema } from "mongoose";

export type HomeHighlightColor = "blue" | "gold";

export interface IHomeHighlightItem {
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  badgeAr?: string;
  badgeEn?: string;
  type?: "award" | "accreditation" | "national" | "international" | "scholarship" | "milestone";
  iconKey?:
    | "trophy"
    | "medal"
    | "shield-check"
    | "globe"
    | "building"
    | "graduation-cap"
    | "star"
    | "target";
  isActive?: boolean;
  title: string;
  description: string;
  imageUrl: string;
  link?: string;
  order: number;
}

export interface IHomeHighlightBlock {
  titleAr?: string;
  titleEn?: string;
  title: string;
  color: HomeHighlightColor;
  sortOrder?: number;
  headerIconKey?: "globe" | "star";
  items: IHomeHighlightItem[];
}

export interface IHomeHighlight extends Document {
  sectionEnabled?: boolean;
  layoutColumns?: 2 | 3;
  sectionTitleAr?: string;
  sectionTitleEn?: string;
  sectionSubtitleAr?: string;
  sectionSubtitleEn?: string;
  sectionTitle: string;
  sectionSubtitle: string;
  blocks: IHomeHighlightBlock[];
  participationSectionEnabled?: boolean;
  participationTitleAr?: string;
  participationTitleEn?: string;
  participationSubtitleAr?: string;
  participationSubtitleEn?: string;
  participationBlocks?: IHomeHighlightBlock[];
  studentShowcaseTitleAr?: string;
  studentShowcaseTitleEn?: string;
  studentShowcaseSubtitleAr?: string;
  studentShowcaseSubtitleEn?: string;
  studentShowcaseFilters?: {
    id: string;
    labelAr?: string;
    labelEn?: string;
    sortOrder?: number;
    isActive?: boolean;
  }[];
  studentShowcaseItems?: {
    id: string;
    titleAr?: string;
    titleEn?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    imageUrl: string;
    category?: string;
    badgeAr?: string;
    badgeEn?: string;
    sortOrder?: number;
    isActive?: boolean;
  }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HomeHighlightItemSchema = new Schema<IHomeHighlightItem>(
  {
    titleAr: { type: String, trim: true, maxlength: 300 },
    titleEn: { type: String, trim: true, maxlength: 300 },
    descriptionAr: { type: String, trim: true, maxlength: 4000 },
    descriptionEn: { type: String, trim: true, maxlength: 4000 },
    badgeAr: { type: String, trim: true, maxlength: 120 },
    badgeEn: { type: String, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["award", "accreditation", "national", "international", "scholarship", "milestone"],
    },
    iconKey: {
      type: String,
      enum: ["trophy", "medal", "shield-check", "globe", "building", "graduation-cap", "star", "target"],
    },
    isActive: { type: Boolean, default: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    imageUrl: { type: String, required: true, trim: true, maxlength: 2000000 },
    link: { type: String, trim: true, maxlength: 4000 },
    order: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const HomeHighlightBlockSchema = new Schema<IHomeHighlightBlock>(
  {
    titleAr: { type: String, trim: true, maxlength: 300 },
    titleEn: { type: String, trim: true, maxlength: 300 },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    color: { type: String, enum: ["blue", "gold"], required: true },
    sortOrder: { type: Number, default: 0 },
    headerIconKey: { type: String, enum: ["globe", "star"] },
    items: { type: [HomeHighlightItemSchema], default: [] },
  },
  { _id: false }
);

const HomeHighlightSchema = new Schema<IHomeHighlight>(
  {
    sectionEnabled: { type: Boolean, default: true },
    layoutColumns: { type: Number, enum: [2, 3], default: 3 },
    sectionTitleAr: { type: String, trim: true, maxlength: 500 },
    sectionTitleEn: { type: String, trim: true, maxlength: 500 },
    sectionSubtitleAr: { type: String, trim: true, maxlength: 2000 },
    sectionSubtitleEn: { type: String, trim: true, maxlength: 2000 },
    sectionTitle: { type: String, required: true, trim: true, maxlength: 500 },
    sectionSubtitle: { type: String, required: true, trim: true, maxlength: 2000 },
    blocks: { type: [HomeHighlightBlockSchema], default: [] },
    participationSectionEnabled: { type: Boolean, default: true },
    participationTitleAr: { type: String, trim: true, maxlength: 500 },
    participationTitleEn: { type: String, trim: true, maxlength: 500 },
    participationSubtitleAr: { type: String, trim: true, maxlength: 2000 },
    participationSubtitleEn: { type: String, trim: true, maxlength: 2000 },
    participationBlocks: { type: [HomeHighlightBlockSchema], default: [] },
    studentShowcaseTitleAr: { type: String, trim: true, maxlength: 500 },
    studentShowcaseTitleEn: { type: String, trim: true, maxlength: 500 },
    studentShowcaseSubtitleAr: { type: String, trim: true, maxlength: 2000 },
    studentShowcaseSubtitleEn: { type: String, trim: true, maxlength: 2000 },
    studentShowcaseFilters: {
      type: [
        new Schema(
          {
            id: { type: String, trim: true, maxlength: 120 },
            labelAr: { type: String, trim: true, maxlength: 200 },
            labelEn: { type: String, trim: true, maxlength: 200 },
            sortOrder: { type: Number, default: 0 },
            isActive: { type: Boolean, default: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    studentShowcaseItems: {
      type: [
        new Schema(
          {
            id: { type: String, trim: true, maxlength: 120 },
            titleAr: { type: String, trim: true, maxlength: 300 },
            titleEn: { type: String, trim: true, maxlength: 300 },
            descriptionAr: { type: String, trim: true, maxlength: 4000 },
            descriptionEn: { type: String, trim: true, maxlength: 4000 },
            imageUrl: { type: String, trim: true, maxlength: 2000000 },
            category: { type: String, trim: true, maxlength: 120 },
            badgeAr: { type: String, trim: true, maxlength: 120 },
            badgeEn: { type: String, trim: true, maxlength: 120 },
            sortOrder: { type: Number, default: 0 },
            isActive: { type: Boolean, default: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

HomeHighlightSchema.index({ isActive: 1, updatedAt: -1 });

const HomeHighlight: Model<IHomeHighlight> =
  mongoose.models.HomeHighlight || mongoose.model<IHomeHighlight>("HomeHighlight", HomeHighlightSchema);

export default HomeHighlight;
