/**
 * Workflow state for achievements (pending → needs_revision → approved → featured flag).
 * Keeps compatibility with legacy `approved` / `featured` booleans when `status` / `isFeatured` are absent.
 */

export type WorkflowDisplayStatus =
  | "pending"
  | "needs_revision"
  | "approved"
  | "featured"
  | "pending_re_review"
  | "rejected";

export type AchievementWorkflowLike = Record<string, unknown> & {
  status?: string;
  isFeatured?: boolean;
  featured?: boolean;
  approved?: boolean;
  approvalStatus?: string;
  verificationStatus?: string;
  pendingReReview?: boolean;
};

/** Mongo filter: approved + platform-featured, including legacy documents without `status` / `isFeatured`. */
export const publicFeaturedAchievementsFilter = (): Record<string, unknown> => ({
  $and: [
    {
      $or: [{ pendingReReview: { $ne: true } }, { pendingReReview: { $exists: false } }],
    },
    {
      $or: [
        { status: "approved", isFeatured: true },
        {
          $and: [
            { approved: true },
            { featured: true },
            {
              $or: [{ status: { $exists: false } }, { status: null }, { status: "approved" }],
            },
          ],
        },
      ],
    },
  ],
});

export const resolveWorkflowDisplayStatus = (
  raw: AchievementWorkflowLike
): WorkflowDisplayStatus => {
  const a = raw as Record<string, unknown>;
  const ex = a.approvalStatus;
  if (
    ex === "featured" ||
    ex === "approved" ||
    ex === "pending" ||
    ex === "needs_revision" ||
    ex === "pending_re_review" ||
    ex === "rejected"
  ) {
    return ex as WorkflowDisplayStatus;
  }

  if (String(a.status ?? "") === "rejected") {
    return "rejected";
  }

  if (a.pendingReReview === true) {
    const st = String(a.status ?? "");
    if (st === "approved" || a.approved === true) return "pending_re_review";
  }

  const statusRaw = a.status;
  const hasExplicitStatus = typeof statusRaw === "string" && statusRaw.length > 0;

  if (hasExplicitStatus) {
    if (statusRaw === "pending") return "pending";
    if (statusRaw === "pending_review") return "pending";
    if (statusRaw === "needs_revision") return "needs_revision";
    if (statusRaw === "rejected") return "rejected";
    if (statusRaw === "approved") {
      return a.isFeatured === true ? "featured" : "approved";
    }
  }

  const ver = String(a.verificationStatus || "");
  if (ver === "verified") return "approved";
  if (ver === "pending_committee_review") return "pending";

  const legacyApproved = raw.approved === true;
  const legacyFeatured = raw.featured === true;
  if (legacyApproved && legacyFeatured) return "featured";
  if (legacyApproved) return "approved";
  return "pending";
};

/** Only approved (final) achievements count toward official points totals. */
export const countsTowardApprovedScore = (raw: AchievementWorkflowLike): boolean => {
  if (raw.pendingReReview === true) return false;
  const s = String(raw.status ?? "");
  if (s === "rejected") return false;
  if (s === "approved") return true;
  if (s === "pending" || s === "pending_review" || s === "needs_revision") return false;
  return raw.approved === true;
};

export const isApprovedForFeature = (doc: {
  status?: string;
  approved?: boolean;
}): boolean => {
  if (doc.status === "approved") return true;
  if (typeof doc.status === "string" && doc.status.length > 0) return false;
  return doc.approved === true;
};

/** Display-only labels for attachment AI execution (admin UI). */
export const formatAttachmentAiExecutionLabel = (
  run: string | null | undefined,
  loc: "ar" | "en"
): string => {
  const s = String(run || "").trim().toLowerCase();
  if (s === "pending") return loc === "ar" ? "بانتظار الفحص" : "Pending";
  if (s === "processing") return loc === "ar" ? "جارٍ الفحص" : "Processing";
  if (s === "completed") return loc === "ar" ? "اكتمل الفحص" : "Completed";
  if (s === "failed") return loc === "ar" ? "فشل الفحص" : "Failed";
  if (s === "idle") return loc === "ar" ? "غير مفعّل" : "Idle";
  return loc === "ar" ? "—" : "—";
};

export const isStudentEditLocked = (raw: AchievementWorkflowLike): boolean => {
  if (raw.pendingReReview === true) return false;
  const st = String(raw.status ?? "");
  if (st === "rejected") return false;
  if (st === "pending" || st === "pending_review" || st === "needs_revision") return false;
  if (st === "approved") return true;
  return raw.approved === true && !st;
};

/** Deletes only allowed while not finally approved. */
export const isStudentDeleteLocked = (raw: AchievementWorkflowLike): boolean => {
  const st = String(raw.status ?? "");
  if (st === "approved") return true;
  if (st === "pending" || st === "pending_review" || st === "needs_revision" || st === "rejected")
    return false;
  return raw.approved === true;
};
