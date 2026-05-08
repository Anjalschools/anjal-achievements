import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAlumniStory extends Document {
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  relatedUserId?: Types.ObjectId;
  graduationYear?: number;
  universityName?: string;
  currentCompany?: string;
  currentPosition?: string;
  featured: boolean;
  published: boolean;
  publishedAt?: Date;
  seoTitle?: string;
  seoDescription?: string;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniStorySchema = new Schema<IAlumniStory>(
  {
    title: { type: String, required: true, trim: true, maxlength: 220 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    excerpt: { type: String, trim: true, maxlength: 600 },
    content: { type: String, trim: true, maxlength: 30_000 },
    coverImage: { type: String, trim: true, maxlength: 1000 },
    relatedUserId: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    graduationYear: { type: Number, min: 1950, max: 2100 },
    universityName: { type: String, trim: true, maxlength: 200 },
    currentCompany: { type: String, trim: true, maxlength: 200 },
    currentPosition: { type: String, trim: true, maxlength: 200 },
    featured: { type: Boolean, default: false, index: true },
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, index: true },
    seoTitle: { type: String, trim: true, maxlength: 220 },
    seoDescription: { type: String, trim: true, maxlength: 320 },
    createdById: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
  },
  { timestamps: true }
);

AlumniStorySchema.index({ published: 1, featured: 1, publishedAt: -1 });
AlumniStorySchema.index({ title: "text", excerpt: "text", content: "text" });

const AlumniStory: Model<IAlumniStory> =
  mongoose.models.AlumniStory || mongoose.model<IAlumniStory>("AlumniStory", AlumniStorySchema);

export default AlumniStory;
