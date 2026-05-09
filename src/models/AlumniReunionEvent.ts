import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniReunionEventType = "in_person" | "online" | "school" | "cohort";

export interface IAlumniReunionEvent extends Document {
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  eventType: AlumniReunionEventType;
  cohortYear?: number;
  location?: string;
  meetingLink?: string;
  startsAt: Date;
  endsAt?: Date;
  coverImage?: string;
  published: boolean;
  featured: boolean;
  publishAt?: Date;
  expiresAt?: Date;
  rsvpCount: number;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniReunionEventSchema = new Schema<IAlumniReunionEvent>(
  {
    title: { type: String, required: true, trim: true, maxlength: 220 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    summary: { type: String, trim: true, maxlength: 600 },
    content: { type: String, trim: true, maxlength: 30_000 },
    eventType: {
      type: String,
      enum: ["in_person", "online", "school", "cohort"],
      required: true,
      index: true,
    },
    cohortYear: { type: Number, min: 1950, max: 2100, index: true },
    location: { type: String, trim: true, maxlength: 300 },
    meetingLink: { type: String, trim: true, maxlength: 1000 },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    coverImage: { type: String, trim: true, maxlength: 1000 },
    published: { type: Boolean, default: false, index: true },
    featured: { type: Boolean, default: false, index: true },
    publishAt: { type: Date },
    expiresAt: { type: Date },
    rsvpCount: { type: Number, default: 0, min: 0 },
    createdById: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
  },
  { timestamps: true }
);

AlumniReunionEventSchema.index({ published: 1, startsAt: 1 });

const AlumniReunionEvent: Model<IAlumniReunionEvent> =
  mongoose.models.AlumniReunionEvent ||
  mongoose.model<IAlumniReunionEvent>("AlumniReunionEvent", AlumniReunionEventSchema);

export default AlumniReunionEvent;
