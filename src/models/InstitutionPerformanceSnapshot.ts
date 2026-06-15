import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type InstitutionPerformanceMetricsPayload = {
  opportunityCount: number;
  applicantCount: number;
  acceptedCount: number;
  rejectedCount: number;
  interviewCount: number;
  completedTraineeCount: number;
  finalReportCount: number;
  acceptanceRatePct: number;
  completionRatePct: number;
  interviewRatePct: number;
  reportCompletionRatePct: number;
  responseTime: {
    firstResponseAvgDays: number;
    firstResponseMedianDays: number;
    reviewAvgDays: number;
    interviewScheduleAvgDays: number;
    finalReportAvgDays: number;
    averageResponseTimeDays: number;
    medianResponseTimeDays: number;
    fastestResponseDays: number;
    slowestResponseDays: number;
  };
  qualityScore: number;
  qualityLabelAr: string;
  qualityLabelEn: string;
  studentFeedbackAvg: number;
  studentFeedbackCount: number;
  supervisorFeedbackAvg: number;
  supervisorFeedbackCount: number;
  messageEngagementPct: number;
  interviewAttendancePct: number;
};

export interface IInstitutionPerformanceSnapshot extends Document {
  organizationId: Types.ObjectId;
  academicYearId?: Types.ObjectId;
  academicYearLabel: string;
  generatedAt: Date;
  metrics: InstitutionPerformanceMetricsPayload;
  createdAt: Date;
  updatedAt: Date;
}

const ResponseTimeSchema = new Schema(
  {
    firstResponseAvgDays: { type: Number, default: 0 },
    firstResponseMedianDays: { type: Number, default: 0 },
    reviewAvgDays: { type: Number, default: 0 },
    interviewScheduleAvgDays: { type: Number, default: 0 },
    finalReportAvgDays: { type: Number, default: 0 },
    averageResponseTimeDays: { type: Number, default: 0 },
    medianResponseTimeDays: { type: Number, default: 0 },
    fastestResponseDays: { type: Number, default: 0 },
    slowestResponseDays: { type: Number, default: 0 },
  },
  { _id: false }
);

const MetricsSchema = new Schema(
  {
    opportunityCount: { type: Number, default: 0 },
    applicantCount: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    interviewCount: { type: Number, default: 0 },
    completedTraineeCount: { type: Number, default: 0 },
    finalReportCount: { type: Number, default: 0 },
    acceptanceRatePct: { type: Number, default: 0 },
    completionRatePct: { type: Number, default: 0 },
    interviewRatePct: { type: Number, default: 0 },
    reportCompletionRatePct: { type: Number, default: 0 },
    responseTime: { type: ResponseTimeSchema, default: () => ({}) },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    qualityLabelAr: { type: String, default: "" },
    qualityLabelEn: { type: String, default: "" },
    studentFeedbackAvg: { type: Number, default: 0 },
    studentFeedbackCount: { type: Number, default: 0 },
    supervisorFeedbackAvg: { type: Number, default: 0 },
    supervisorFeedbackCount: { type: Number, default: 0 },
    messageEngagementPct: { type: Number, default: 0 },
    interviewAttendancePct: { type: Number, default: 0 },
  },
  { _id: false }
);

const InstitutionPerformanceSnapshotSchema = new Schema<IInstitutionPerformanceSnapshot>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerOrganization",
      required: true,
      index: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      index: true,
    },
    academicYearLabel: { type: String, required: true, trim: true, index: true },
    generatedAt: { type: Date, required: true, index: true },
    metrics: { type: MetricsSchema, required: true },
  },
  { timestamps: true }
);

InstitutionPerformanceSnapshotSchema.index(
  { organizationId: 1, academicYearId: 1 },
  { unique: true, sparse: true }
);
InstitutionPerformanceSnapshotSchema.index({ organizationId: 1, academicYearLabel: 1, generatedAt: -1 });

const InstitutionPerformanceSnapshot: Model<IInstitutionPerformanceSnapshot> =
  mongoose.models.InstitutionPerformanceSnapshot ||
  mongoose.model<IInstitutionPerformanceSnapshot>(
    "InstitutionPerformanceSnapshot",
    InstitutionPerformanceSnapshotSchema
  );

export default InstitutionPerformanceSnapshot;
