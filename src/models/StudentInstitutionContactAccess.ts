import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IStudentInstitutionContactAccess extends Document {
  applicationId: Types.ObjectId;
  studentId: Types.ObjectId;
  institutionId: Types.ObjectId;
  grantedBy: Types.ObjectId;
  grantedAt: Date;
  revokedAt?: Date;
  isActive: boolean;
  shareStudentPhone: boolean;
  shareParentPhone: boolean;
  shareStudentEmail: boolean;
  shareInstitutionContact: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentInstitutionContactAccessSchema = new Schema<IStudentInstitutionContactAccess>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
      unique: true,
      index: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true, index: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    grantedAt: { type: Date, required: true, default: Date.now },
    revokedAt: { type: Date, sparse: true },
    isActive: { type: Boolean, default: true, index: true },
    shareStudentPhone: { type: Boolean, default: false },
    shareParentPhone: { type: Boolean, default: false },
    shareStudentEmail: { type: Boolean, default: false },
    shareInstitutionContact: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

StudentInstitutionContactAccessSchema.index({ institutionId: 1, isActive: 1 });
StudentInstitutionContactAccessSchema.index({ studentId: 1, isActive: 1 });

const StudentInstitutionContactAccess: Model<IStudentInstitutionContactAccess> =
  mongoose.models.StudentInstitutionContactAccess ||
  mongoose.model<IStudentInstitutionContactAccess>(
    "StudentInstitutionContactAccess",
    StudentInstitutionContactAccessSchema
  );

export default StudentInstitutionContactAccess;
