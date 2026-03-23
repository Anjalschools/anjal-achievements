import mongoose, { Schema, Document, Model } from "mongoose";
import type { AchievementAttachmentStored } from "@/lib/achievement-attachments";

export interface IAchievement extends Document {
  userId: mongoose.Types.ObjectId;
  
  // Basic Info
  achievementType: string;
  achievementCategory?: string;
  /** academic | technical | cultural | research | volunteer | qudurat | gifted_screening | mawhiba_annual | other */
  achievementClassification?: string;
  achievementName?: string;
  nameAr?: string;
  nameEn?: string;
  customAchievementName?: string;
  achievementLevel: string;
  participationType: string;
  teamRole?: string;
  
  // Result
  resultType: string;
  resultValue?: string;
  medalType?: string;
  rank?: string;
  nominationText?: string;
  specialAwardText?: string;
  recognitionText?: string;
  otherResultText?: string;
  
  // Type-specific fields
  programName?: string;
  customProgramName?: string;
  competitionName?: string;
  customCompetitionName?: string;
  exhibitionName?: string;
  customExhibitionName?: string;
  olympiadMeeting?: string;
  olympiadField?: string;
  excellenceProgramName?: string;
  customExcellenceProgramName?: string;
  qudratScore?: string;
  mawhibaAnnualRank?: string;
  mawhibaAnnualSubject?: string;
  giftedDiscoveryScore?: number;
  
  // Auto-calculated
  inferredField?: string;
  score?: number;
  scoreBreakdown?: mongoose.Schema.Types.Mixed;
  
  // Legacy fields (for backward compatibility)
  title?: string;
  description?: string;
  domain?: string;
  competition?: string;
  organization?: string;
  date?: Date;
  level?: string;
  position?: number;
  image?: string;
  attachments?: AchievementAttachmentStored[];
  certificateNumber?: string;
  
  // Status (workflow)
  status?: "pending" | "pending_review" | "needs_revision" | "approved" | "rejected";
  isFeatured: boolean;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  featuredAt?: Date;
  featureNote?: string;
  reviewNote?: string;
  reviewComments?: Array<{
    authorId?: mongoose.Types.ObjectId;
    authorRole?: string;
    message: string;
    type:
      | "revision_request"
      | "approval_note"
      | "deletion_note"
      | "system"
      | "resubmit"
      | "admin_rejection";
    createdAt: Date;
  }>;
  lockedAt?: Date;
  lockedBy?: mongoose.Types.ObjectId;
  aiReviewStatus?: "clean" | "flagged" | "error";
  aiFlags?: string[];
  aiSummary?: string;
  aiConfidence?: number;
  aiSuggestedAction?:
    | "review"
    | "needs_revision"
    | "possible_duplicate"
    | "possible_level_mismatch";
  aiReviewedAt?: Date;
  certificateIssued?: boolean;
  certificateIssuedAt?: Date;
  certificateId?: string;
  certificateVerificationToken?: string;
  /** Monotonic issue counter; incremented on each (re)issue */
  certificateVersion?: number;
  /** Frozen bilingual payload at issue time */
  certificateSnapshot?: Record<string, unknown>;
  /** Platform admin party (distinct from generic reviewedAt) */
  adminApprovedAt?: Date;
  adminApprovedBy?: mongoose.Types.ObjectId;
  /** School principal / lead approval for appreciation certificate */
  principalApprovedAt?: Date;
  principalApprovedBy?: mongoose.Types.ObjectId;
  /** Activity supervisor approval for appreciation certificate */
  activitySupervisorApprovedAt?: Date;
  activitySupervisorApprovedBy?: mongoose.Types.ObjectId;
  /** Judge / evaluator party for certificate authorization */
  judgeApprovedAt?: Date;
  judgeApprovedBy?: mongoose.Types.ObjectId;
  /** First successful certificate issuance — who triggered it */
  certificateApprovedByRole?: "admin" | "principal" | "activitySupervisor" | "judge";
  certificateApprovedById?: mongoose.Types.ObjectId;
  certificateApprovedAt?: Date;
  /** Student edited after approval or admin returned to pending — certificate invalid until re-issued */
  certificateRevokedAt?: Date;
  /** Prior verification tokens (QR) — lookup for superseded/revoked messaging */
  certificateSupersededTokens?: string[];
  /** Legacy mirrors — kept in sync in pre("save") */
  featured: boolean;
  approved: boolean;
  
  // Additional
  achievementYear: number;
  evidenceUrl?: string;
  evidenceFileName?: string;
  evidenceRequiredMode?: "provided" | "skipped";
  verificationStatus?: "unverified" | "pending_committee_review" | "verified" | "mismatch";
  verificationSummary?: string;
  evidenceExtractedData?: Record<string, unknown> | null;
  evidenceMatchStatus?: "unknown" | "matched" | "partial" | "mismatched";
  requiresCommitteeReview?: boolean;

  /** Student edited after approval — awaiting admin re-approval */
  pendingReReview?: boolean;
  lastStudentEditAt?: Date;
  lastEditedByRole?: "student" | "admin";
  editVersion?: number;
  changedFields?: string[];
  previousApprovedSnapshot?: Record<string, unknown>;
  lastAdminReviewedAt?: Date;

  /** Cached on-demand admin AI attachment vs record review (advisory). */
  adminAttachmentAiReview?: Record<string, unknown>;
  /** Human reviewer marked this row as duplicate (independent of AI duplicate hints). */
  adminDuplicateMarked?: boolean;
  /** Internal admin-only note; not shown to students in APIs. */
  adminWorkflowNote?: string;

  /** Workflow flags (returned for edit, student resubmit, etc.) — optional extension layer. */
  workflowState?: {
    wasReturnedForEdit?: boolean;
    resubmittedByStudent?: boolean;
    resubmittedAt?: Date;
    revisionCount?: number;
    lastAction?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const AchievementSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    // Basic Info
    achievementType: {
      type: String,
      required: true,
      enum: [
        "competition",
        "program",
        "exhibition",
        "olympiad",
        "excellence_program",
        "qudrat",
        "mawhiba_annual",
        "gifted_discovery",
        "other",
      ],
      index: true,
    },
    achievementCategory: {
      type: String,
      enum: [
        "competition",
        "program",
        "exhibition",
        "olympiad",
        "excellence_program",
        "qudrat",
        "mawhiba",
        "gifted_screening",
        "other",
      ],
      trim: true,
    },
    achievementClassification: {
      type: String,
      enum: [
        "academic",
        "technical",
        "cultural",
        "research",
        "volunteer",
        "qudurat",
        "gifted_screening",
        "mawhiba_annual",
        "other",
      ],
      trim: true,
    },
    achievementName: {
      type: String,
      trim: true,
    },
    nameAr: {
      type: String,
      trim: true,
    },
    nameEn: {
      type: String,
      trim: true,
    },
    customAchievementName: {
      type: String,
      trim: true,
    },
    achievementLevel: {
      type: String,
      required: true,
      enum: ["school", "province", "kingdom", "international"],
      index: true,
    },
    participationType: {
      type: String,
      required: true,
      enum: ["individual", "team"],
    },
    teamRole: {
      type: String,
      trim: true,
    },
    
    // Result
    resultType: {
      type: String,
      required: true,
      enum: [
        "participation",
        "medal",
        "rank",
        "nomination",
        "special_award",
        "recognition",
        "other",
        "score",
        "completion",
      ],
    },
    resultValue: {
      type: String,
      trim: true,
    },
    medalType: {
      type: String,
      enum: ["gold", "silver", "bronze"],
    },
    rank: {
      type: String,
      enum: [
        "first",
        "second",
        "third",
        "fourth",
        "fifth",
        "sixth",
        "seventh",
        "eighth",
        "ninth",
        "tenth",
      ],
    },
    nominationText: {
      type: String,
      trim: true,
    },
    specialAwardText: {
      type: String,
      trim: true,
    },
    recognitionText: {
      type: String,
      trim: true,
    },
    otherResultText: {
      type: String,
      trim: true,
    },
    
    // Type-specific fields
    programName: {
      type: String,
      trim: true,
    },
    customProgramName: {
      type: String,
      trim: true,
    },
    competitionName: {
      type: String,
      trim: true,
    },
    customCompetitionName: {
      type: String,
      trim: true,
    },
    exhibitionName: {
      type: String,
      trim: true,
    },
    customExhibitionName: {
      type: String,
      trim: true,
    },
    olympiadMeeting: {
      type: String,
      trim: true,
    },
    olympiadField: {
      type: String,
      trim: true,
    },
    excellenceProgramName: {
      type: String,
      trim: true,
    },
    customExcellenceProgramName: {
      type: String,
      trim: true,
    },
    qudratScore: {
      type: String,
      trim: true,
    },
    mawhibaAnnualRank: {
      type: String,
      trim: true,
    },
    mawhibaAnnualSubject: {
      type: String,
      trim: true,
    },
    giftedDiscoveryScore: {
      type: Number,
      min: 0,
      max: 2000,
    },
    
    // Auto-calculated
    inferredField: {
      type: String,
      trim: true,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    scoreBreakdown: {
      type: Schema.Types.Mixed,
    },
    
    // Legacy fields (for backward compatibility)
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
    },
    competition: {
      type: String,
      trim: true,
    },
    organization: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
    },
    level: {
      type: String,
      trim: true,
    },
    position: {
      type: Number,
      min: 1,
      max: 10,
    },
    image: {
      type: String,
    },
    attachments: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    certificateNumber: {
      type: String,
      trim: true,
    },
    
    // Status (workflow)
    status: {
      type: String,
      enum: ["pending", "pending_review", "needs_revision", "approved", "rejected"],
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    featuredAt: {
      type: Date,
    },
    featureNote: {
      type: String,
      trim: true,
    },
    reviewNote: {
      type: String,
      trim: true,
    },
    reviewComments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: "User" },
        authorRole: { type: String, trim: true },
        message: { type: String, trim: true, maxlength: 4000 },
        type: {
          type: String,
          enum: [
            "revision_request",
            "approval_note",
            "deletion_note",
            "system",
            "resubmit",
            "admin_rejection",
          ],
          required: true,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    lockedAt: { type: Date },
    lockedBy: { type: Schema.Types.ObjectId, ref: "User" },
    aiReviewStatus: {
      type: String,
      enum: ["clean", "flagged", "error"],
    },
    aiFlags: [{ type: String, trim: true }],
    aiSummary: { type: String, trim: true },
    aiConfidence: { type: Number, min: 0, max: 1 },
    aiSuggestedAction: {
      type: String,
      enum: ["review", "needs_revision", "possible_duplicate", "possible_level_mismatch"],
    },
    aiReviewedAt: { type: Date },
    certificateIssued: { type: Boolean, default: false },
    certificateIssuedAt: { type: Date },
    certificateId: { type: String, trim: true, sparse: true, unique: true },
    certificateVerificationToken: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    certificateVersion: { type: Number, min: 0, default: 0 },
    certificateSnapshot: { type: Schema.Types.Mixed, default: undefined },
    adminApprovedAt: { type: Date },
    adminApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    principalApprovedAt: { type: Date },
    principalApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    activitySupervisorApprovedAt: { type: Date },
    activitySupervisorApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    judgeApprovedAt: { type: Date },
    judgeApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    certificateApprovedByRole: {
      type: String,
      enum: ["admin", "principal", "activitySupervisor", "judge"],
    },
    certificateApprovedById: { type: Schema.Types.ObjectId, ref: "User" },
    certificateApprovedAt: { type: Date },
    certificateRevokedAt: { type: Date },
    certificateSupersededTokens: [{ type: String, trim: true }],
    featured: {
      type: Boolean,
      default: false,
    },
    approved: {
      type: Boolean,
      default: false,
    },
    
    // Additional
    achievementYear: {
      type: Number,
      required: true,
      index: true,
    },
    evidenceUrl: {
      type: String,
      trim: true,
    },
    evidenceFileName: {
      type: String,
      trim: true,
    },
    evidenceRequiredMode: {
      type: String,
      enum: ["provided", "skipped"],
      default: "provided",
    },
    verificationStatus: {
      type: String,
      enum: ["unverified", "pending_committee_review", "verified", "mismatch"],
      default: "unverified",
    },
    verificationSummary: {
      type: String,
      trim: true,
    },
    evidenceExtractedData: {
      type: Schema.Types.Mixed,
      default: null,
    },
    evidenceMatchStatus: {
      type: String,
      enum: ["unknown", "matched", "partial", "mismatched"],
      default: "unknown",
    },
    requiresCommitteeReview: {
      type: Boolean,
      default: false,
    },
    pendingReReview: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastStudentEditAt: { type: Date },
    lastEditedByRole: {
      type: String,
      enum: ["student", "admin"],
    },
    editVersion: { type: Number, min: 0, default: 0 },
    changedFields: [{ type: String, trim: true }],
    previousApprovedSnapshot: { type: Schema.Types.Mixed, default: undefined },
    lastAdminReviewedAt: { type: Date },
    adminAttachmentAiReview: { type: Schema.Types.Mixed, default: undefined },
    adminDuplicateMarked: { type: Boolean, default: false, index: true },
    adminWorkflowNote: { type: String, trim: true, maxlength: 4000 },
    workflowState: { type: Schema.Types.Mixed, default: undefined },
  },
  {
    timestamps: true,
  }
);

AchievementSchema.pre("save", async function preAchievementWorkflow() {
  const doc = this as mongoose.Document & {
    status?: string;
    isFeatured?: boolean;
    featured?: boolean;
    approved?: boolean;
    featuredAt?: Date | null;
  };

  let st = doc.get("status") as string | undefined;
  if (
    st !== "pending" &&
    st !== "pending_review" &&
    st !== "needs_revision" &&
    st !== "approved" &&
    st !== "rejected"
  ) {
    st = doc.get("approved") === true ? "approved" : "pending";
    doc.set("status", st);
  }

  if (
    st === "approved" &&
    doc.get("isFeatured") !== true &&
    doc.get("featured") === true
  ) {
    doc.set("isFeatured", true);
  }

  if (doc.get("isFeatured") === true && st !== "approved") {
    throw new Error("isFeatured requires status approved");
  }

  if (st === "pending" || st === "pending_review" || st === "needs_revision" || st === "rejected") {
    doc.set("isFeatured", false);
    doc.set("featured", false);
    doc.set("featuredAt", undefined);
    doc.set("approved", false);
  }

  if (st === "approved") {
    doc.set("approved", true);
  }

  doc.set("featured", doc.get("isFeatured") === true);
});

// Indexes
AchievementSchema.index({ userId: 1, createdAt: -1 });
AchievementSchema.index({ featured: 1, approved: 1 });
AchievementSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });

const Achievement: Model<IAchievement> =
  mongoose.models.Achievement ||
  mongoose.model<IAchievement>("Achievement", AchievementSchema);

export default Achievement;
