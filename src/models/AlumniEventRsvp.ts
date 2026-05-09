import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniRsvpStatus = "going" | "maybe" | "declined";

export interface IAlumniEventRsvp extends Document {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  status: AlumniRsvpStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniEventRsvpSchema = new Schema<IAlumniEventRsvp>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "AlumniReunionEvent", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["going", "maybe", "declined"],
      required: true,
    },
  },
  { timestamps: true }
);

AlumniEventRsvpSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const AlumniEventRsvp: Model<IAlumniEventRsvp> =
  mongoose.models.AlumniEventRsvp ||
  mongoose.model<IAlumniEventRsvp>("AlumniEventRsvp", AlumniEventRsvpSchema);

export default AlumniEventRsvp;
