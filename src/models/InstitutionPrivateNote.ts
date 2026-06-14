import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { INSTITUTION_PRIVATE_NOTE_CATEGORIES } from "@/lib/partnerships/institution-candidate-pipeline-constants";

export interface IInstitutionPrivateNote extends Document {
  applicationId: Types.ObjectId;
  organizationId: Types.ObjectId;
  authorId: Types.ObjectId;
  category: (typeof INSTITUTION_PRIVATE_NOTE_CATEGORIES)[number];
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionPrivateNoteSchema = new Schema<IInstitutionPrivateNote>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerOrganization",
      required: true,
      index: true,
    },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: {
      type: String,
      enum: INSTITUTION_PRIVATE_NOTE_CATEGORIES,
      default: "general",
      index: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
  },
  { timestamps: true }
);

InstitutionPrivateNoteSchema.index({ applicationId: 1, createdAt: -1 });

const InstitutionPrivateNote: Model<IInstitutionPrivateNote> =
  mongoose.models.InstitutionPrivateNote ||
  mongoose.model<IInstitutionPrivateNote>("InstitutionPrivateNote", InstitutionPrivateNoteSchema);

export default InstitutionPrivateNote;
