import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  ACTIVE_TRAINING_APPLICATION_STATUSES,
  STUDENT_TRAINING_APPLICATION_STATUSES,
  type StudentTrainingApplicationStatus,
} from "@/lib/partnerships/partnerships-constants";
import type { TrainingApplicationTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import type { InstitutionDecisionStatus } from "@/lib/partnerships/partnerships-messaging-constants";
import type { TrainingStudentSnapshot } from "@/lib/partnerships/partnerships-student-snapshot";

export interface IStudentTrainingApplication extends Document {
  studentId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  status: StudentTrainingApplicationStatus;
  institutionStatus?: InstitutionDecisionStatus;
  academicYear: string;
  /** Optional link to SchoolYear document (Phase 10.1 — backward compatible). */
  academicYearId?: Types.ObjectId;
  /** Display label e.g. 2025/2026 (Phase 10.1 — backward compatible). */
  academicYearLabel?: string;
  studentSnapshot: TrainingStudentSnapshot;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewNotes?: string;
  rejectionReason?: string;
  /** Optional student cover letter at submission time. */
  applicationMessage?: string;
  /** Optional student notes (editable before approval). */
  studentNotes?: string;
  timeline?: TrainingApplicationTimelineEvent[];
  archived?: boolean;
  archivedAt?: Date;
  adminCancelledAt?: Date;
  adminCancelledBy?: Types.ObjectId;
  adminCancellationReasonCode?: string;
  adminCancellationReasonNote?: string;
  previousStatusBeforeAdminCancel?: string;
  slaReviewDueAt?: Date;
  slaInstitutionDueAt?: Date;
  slaCompletionDueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 300 },
    grade: { type: String, required: true, trim: true, maxlength: 20 },
    stage: { type: String, required: true, trim: true, maxlength: 40 },
    gender: { type: String, required: true, trim: true, maxlength: 20 },
    schoolType: { type: String, trim: true, maxlength: 40 },
    school: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const TimelineEventSchema = new Schema(
  {
    at: { type: Date, required: true },
    action: { type: String, required: true, trim: true, maxlength: 80 },
    fromStatus: { type: String, trim: true, maxlength: 40 },
    toStatus: { type: String, trim: true, maxlength: 40 },
    actorId: { type: String, trim: true, maxlength: 40 },
    actorName: { type: String, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 4000 },
  },
  { _id: false }
);

const StudentTrainingApplicationSchema = new Schema<IStudentTrainingApplication>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: "TrainingOpportunity", required: true },
    status: {
      type: String,
      enum: STUDENT_TRAINING_APPLICATION_STATUSES,
      required: true,
      default: "submitted",
      index: true,
    },
    institutionStatus: {
      type: String,
      enum: ["institution_pending", "institution_interview", "institution_accepted", "institution_rejected"],
      sparse: true,
      index: true,
    },
    academicYear: { type: String, required: true, trim: true, maxlength: 80, index: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", sparse: true, index: true },
    academicYearLabel: { type: String, trim: true, maxlength: 80, sparse: true },
    studentSnapshot: { type: StudentSnapshotSchema, required: true },
    submittedAt: { type: Date, index: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    reviewNotes: { type: String, trim: true, maxlength: 12000 },
    rejectionReason: { type: String, trim: true, maxlength: 4000 },
    applicationMessage: { type: String, trim: true, maxlength: 6000 },
    studentNotes: { type: String, trim: true, maxlength: 4000 },
    timeline: { type: [TimelineEventSchema], default: [] },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
    adminCancelledAt: { type: Date, sparse: true },
    adminCancelledBy: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    adminCancellationReasonCode: { type: String, trim: true, maxlength: 80, sparse: true },
    adminCancellationReasonNote: { type: String, trim: true, maxlength: 4000 },
    previousStatusBeforeAdminCancel: { type: String, trim: true, maxlength: 40 },
    slaReviewDueAt: { type: Date, index: true },
    slaInstitutionDueAt: { type: Date, index: true },
    slaCompletionDueAt: { type: Date, index: true },
  },
  { timestamps: true }
);

StudentTrainingApplicationSchema.index(
  { studentId: 1, opportunityId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "administratively_cancelled" } },
    name: "student_opportunity_active_unique",
  }
);
StudentTrainingApplicationSchema.index({ opportunityId: 1, status: 1 });
StudentTrainingApplicationSchema.index({ studentId: 1, status: 1, academicYear: 1 });
StudentTrainingApplicationSchema.index({ "studentSnapshot.grade": 1, status: 1 });
StudentTrainingApplicationSchema.index({ "studentSnapshot.gender": 1, status: 1 });
StudentTrainingApplicationSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [...ACTIVE_TRAINING_APPLICATION_STATUSES] } },
    name: "student_one_active_training_application",
  }
);

const StudentTrainingApplication: Model<IStudentTrainingApplication> =
  mongoose.models.StudentTrainingApplication ||
  mongoose.model<IStudentTrainingApplication>("StudentTrainingApplication", StudentTrainingApplicationSchema);

export default StudentTrainingApplication;
