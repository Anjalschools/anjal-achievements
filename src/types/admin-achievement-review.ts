import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";

export type AdminReviewTab =
  | "all"
  | "pending"
  | "needs_revision"
  | "approved"
  | "featured"
  | "pending_re_review"
  | "ai_flagged"
  | "duplicate"
  | "level_mismatch"
  | "attachment_ai_mismatch"
  | "attachment_ai_unclear"
  | "attachment_ai_match"
  | "no_attachments"
  | "admin_duplicate_marked"
  | "rejected";

export type AdminAchievementReviewListRow = {
  id: string;
  title: string;
  achievementType?: string;
  achievementCategory?: string;
  achievementClassification?: string;
  achievementLevel?: string;
  inferredField?: string;
  organization?: string;
  competitionName?: string;
  programName?: string;
  exhibitionName?: string;
  customCompetitionName?: string;
  participationType?: string;
  resultType?: string;
  medalType?: string;
  rank?: string;
  resultValue?: string;
  nominationText?: string;
  specialAwardText?: string;
  attachments: string[];
  attachmentsCount?: number;
  date: string;
  updatedAt: string | null;
  lastStudentEditAt: string | null;
  lastEditedByRole?: string;
  editVersion?: number;
  image: string | null;
  status: string;
  isFeatured: boolean;
  approvalStatus: WorkflowDisplayStatus;
  pendingReReview?: boolean;
  /** True after student resubmitted following admin revision request (workflowState). */
  resubmittedByStudent?: boolean;
  reviewNote?: string;
  aiReviewStatus?: string;
  aiFlags?: string[];
  aiSummary?: string;
  aiSuggestedAction?: string;
  aiConfidence?: number | null;
  student: { fullName: string; email: string; grade?: string; section?: string };
  principalApprovedAt?: string | null;
  activitySupervisorApprovedAt?: string | null;
  adminApprovedAt?: string | null;
  judgeApprovedAt?: string | null;
  certificateIssued?: boolean;
  certificateRevokedAt?: string | null;
  certificateApprovedByRole?: string | null;
  certificateApprovedAt?: string | null;
  certificateIssuedAt?: string | null;
  certificateStatus?: string;
  certificateEligible?: boolean;
  adminAttachmentOverall?: string | null;
  adminAttachmentAiReview?: Record<string, unknown> | null;
  adminDuplicateMarked?: boolean;
  adminWorkflowNote?: string;
  duplicateYearHint?: { hasYearDuplicate: boolean; yearDuplicateCount: number } | null;
  nameAr?: string;
  nameEn?: string;
  achievementName?: string;
  customAchievementName?: string;
};

export type DuplicateReviewPayload = {
  hasDuplicate: boolean;
  count: number;
  items: Array<{
    id: string;
    title: string;
    achievementYear: number;
    updatedAt: string | null;
    status?: string;
  }>;
  comparableYear: number;
  nameKeyNormalized: string;
};

export type AdminAchievementDetailApi = {
  id?: string;
  achievement: Record<string, unknown>;
  computed: { approvalStatus: WorkflowDisplayStatus; pendingReReview: boolean; dateIso: string };
  duplicateReview?: DuplicateReviewPayload | null;
  student: Record<string, string | undefined> | null;
};
