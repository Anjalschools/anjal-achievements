/**
 * Mongo filters for admin achievement review lists (supports legacy docs without `status` / `isFeatured`).
 */

import { DUPLICATE_FLAG, LEVEL_MISMATCH_FLAG } from "@/lib/achievement-review-rules";

export type AdminAchievementTab =
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

const approvedDocs = {
  $or: [
    { status: "approved" },
    {
      $and: [
        { $or: [{ status: { $exists: false } }, { status: null }] },
        { approved: true },
      ],
    },
  ],
} as const;

const featuredDocs = {
  $and: [
    approvedDocs,
    {
      $or: [{ isFeatured: true }, { featured: true }],
    },
  ],
} as const;

/** Approved / featured without pending student re-review, or rejected — excluded from AI work queue. */
const excludeFromAdminAiFlaggedQueue = {
  $or: [
    { status: "rejected" },
    {
      $and: [
        {
          $or: [{ pendingReReview: { $ne: true } }, { pendingReReview: { $exists: false } }],
        },
        {
          $or: [
            { status: "approved" },
            { isFeatured: true },
            {
              $and: [{ featured: true }, { approved: true }],
            },
            {
              $and: [
                { approved: true },
                {
                  $or: [{ status: { $exists: false } }, { status: null }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} as const;

export const buildAdminAchievementListFilter = (
  tab: AdminAchievementTab
): Record<string, unknown> => {
  switch (tab) {
    case "pending":
      return { status: { $in: ["pending", "pending_review"] } };
    case "needs_revision":
      return { status: "needs_revision" };
    case "approved":
      return { ...approvedDocs };
    case "featured":
      return { ...featuredDocs };
    case "pending_re_review":
      /** Legacy: edit after approval. New: `pending_review` + workflow (spec). Also `pending`+workflow for older rows. */
      return {
        $or: [
          { pendingReReview: true },
          {
            $and: [
              { status: "pending_review" },
              { "workflowState.wasReturnedForEdit": true },
              { "workflowState.resubmittedByStudent": true },
            ],
          },
          {
            $and: [
              { status: "pending" },
              { "workflowState.wasReturnedForEdit": true },
              { "workflowState.resubmittedByStudent": true },
            ],
          },
        ],
      };
    case "ai_flagged":
      /** Work queue only: same signals as before, but drop terminal approved/featured (no re-review) and rejected. */
      return {
        $and: [
          {
            $or: [
              { aiReviewStatus: "flagged" },
              { adminDuplicateMarked: true },
              { aiFlags: DUPLICATE_FLAG },
              { aiFlags: LEVEL_MISMATCH_FLAG },
              { "adminAttachmentAiReview.overallMatchStatus": "mismatch" },
              { "adminAttachmentAiReview.overallMatchStatus": "unclear" },
            ],
          },
          { $nor: [excludeFromAdminAiFlaggedQueue] },
        ],
      };
    case "duplicate":
      return { aiFlags: DUPLICATE_FLAG };
    case "level_mismatch":
      return { aiFlags: LEVEL_MISMATCH_FLAG };
    case "attachment_ai_mismatch":
      return { "adminAttachmentAiReview.overallMatchStatus": "mismatch" };
    case "attachment_ai_unclear":
      return { "adminAttachmentAiReview.overallMatchStatus": "unclear" };
    case "attachment_ai_match":
      return { "adminAttachmentAiReview.overallMatchStatus": "match" };
    case "no_attachments":
      return {
        $and: [
          { $or: [{ image: { $exists: false } }, { image: null }, { image: "" }] },
          {
            $or: [{ attachments: { $exists: false } }, { attachments: { $size: 0 } }],
          },
        ],
      };
    case "admin_duplicate_marked":
      return { adminDuplicateMarked: true };
    case "rejected":
      return { status: "rejected" };
    default:
      return {};
  }
};
