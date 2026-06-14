import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IInstitutionCandidateTag extends Document {
  applicationId: Types.ObjectId;
  organizationId: Types.ObjectId;
  tag: string;
  addedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionCandidateTagSchema = new Schema<IInstitutionCandidateTag>(
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
    tag: { type: String, required: true, trim: true, maxlength: 80, index: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

InstitutionCandidateTagSchema.index({ applicationId: 1, tag: 1 }, { unique: true });

const InstitutionCandidateTag: Model<IInstitutionCandidateTag> =
  mongoose.models.InstitutionCandidateTag ||
  mongoose.model<IInstitutionCandidateTag>("InstitutionCandidateTag", InstitutionCandidateTagSchema);

export default InstitutionCandidateTag;
