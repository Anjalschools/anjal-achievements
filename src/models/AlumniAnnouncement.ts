import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAlumniAnnouncement extends Document {
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  category: string;
  targetCohorts?: number[];
  targetUniversities?: string[];
  targetIndustries?: string[];
  coverImage?: string;
  published: boolean;
  featured: boolean;
  pinned?: boolean;
  publishAt?: Date;
  expiresAt?: Date;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniAnnouncementSchema = new Schema<IAlumniAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 220 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    summary: { type: String, trim: true, maxlength: 600 },
    content: { type: String, trim: true, maxlength: 30_000 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    targetCohorts: [{ type: Number, min: 1950, max: 2100 }],
    targetUniversities: [{ type: String, trim: true, maxlength: 200 }],
    targetIndustries: [{ type: String, trim: true, maxlength: 120 }],
    coverImage: { type: String, trim: true, maxlength: 1000 },
    published: { type: Boolean, default: false, index: true },
    featured: { type: Boolean, default: false, index: true },
    pinned: { type: Boolean, default: false, index: true },
    publishAt: { type: Date, index: true },
    expiresAt: { type: Date, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
  },
  { timestamps: true }
);

AlumniAnnouncementSchema.index({ published: 1, featured: 1, publishAt: -1 });

const AlumniAnnouncement: Model<IAlumniAnnouncement> =
  mongoose.models.AlumniAnnouncement ||
  mongoose.model<IAlumniAnnouncement>("AlumniAnnouncement", AlumniAnnouncementSchema);

export default AlumniAnnouncement;
