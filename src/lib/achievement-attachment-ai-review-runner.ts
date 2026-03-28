/**
 * Server-only: queue / run attachment AI review and persist (student + admin saves).
 */

import "server-only";

import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { isAiAssistEnabled } from "@/lib/openai-env";
import {
  buildGlobalFallbackAttachmentReview,
  executeAttachmentAiVerification,
} from "@/lib/achievement-admin-attachment-ai";
import {
  computeAiReviewInputSignature,
  hasAnalyzableAttachmentEvidence,
} from "@/lib/attachment-ai-review-signature";
import type { AdminAttachmentAiReviewResult } from "@/types/admin-attachment-ai-review";

const mergeReviewPayload = (
  prev: Record<string, unknown> | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> => ({
  ...(prev && typeof prev === "object" ? prev : {}),
  ...patch,
});

/**
 * Fire-and-forget after achievement mutations when evidence exists.
 * Does not throw to callers; logs failures.
 */
export const scheduleAchievementAttachmentAiReviewAfterMutation = (
  achievementId: string,
  trigger: string
): void => {
  if (!isAiAssistEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] auto_review_skipped", { achievementId, trigger, reason: "ai_disabled" });
    return;
  }
  void runAchievementAttachmentAiReviewJob(achievementId, trigger).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[AI_REVIEW] auto_review_failed", { achievementId, trigger, err });
  });
};

export async function runAchievementAttachmentAiReviewJob(
  achievementId: string,
  trigger: string
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(achievementId)) return;
  await connectDB();

  const doc = await Achievement.findById(achievementId)
    .populate("userId", "fullName fullNameAr fullNameEn email")
    .lean();
  if (!doc) return;

  const a = doc as unknown as Record<string, unknown>;
  if (!hasAnalyzableAttachmentEvidence(a)) {
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] auto_review_skipped", { achievementId, trigger, reason: "no_evidence" });
    return;
  }

  const signature = computeAiReviewInputSignature(a);
  const prevAr = (a.adminAttachmentAiReview || {}) as Record<string, unknown>;
  if (prevAr.aiReviewRunStatus === "processing") {
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] auto_review_skipped", { achievementId, trigger, reason: "already_processing" });
    return;
  }
  if (
    prevAr.aiReviewRunStatus === "completed" &&
    prevAr.aiReviewInputSignature === signature &&
    typeof prevAr.overallMatchStatus === "string"
  ) {
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] review_skipped_no_changes", { achievementId, trigger });
    return;
  }

  await Achievement.updateOne(
    { _id: new mongoose.Types.ObjectId(achievementId) },
    {
      $set: {
        adminAttachmentAiReview: mergeReviewPayload(prevAr, {
          aiReviewRunStatus: "pending",
          aiReviewInputSignature: signature,
        }),
      },
    }
  );

  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] auto_review_started", { achievementId, trigger });

  const processingBase = await Achievement.findById(achievementId).lean();
  const processingPrev = (processingBase?.adminAttachmentAiReview || {}) as Record<string, unknown>;
  await Achievement.updateOne(
    { _id: new mongoose.Types.ObjectId(achievementId) },
    {
      $set: {
        adminAttachmentAiReview: mergeReviewPayload(processingPrev, {
          aiReviewRunStatus: "processing",
          aiReviewInputSignature: signature,
        }),
      },
    }
  );

  const user = a.userId as Record<string, unknown> | null;
  const student =
    user && typeof user === "object"
      ? {
          fullName: String(user.fullName || user.fullNameAr || ""),
          fullNameAr: user.fullNameAr ? String(user.fullNameAr) : undefined,
          fullNameEn: user.fullNameEn ? String(user.fullNameEn) : undefined,
        }
      : null;

  let payload: AdminAttachmentAiReviewResult;
  let hardFailed = false;
  try {
    const result = await executeAttachmentAiVerification({
      achievement: a,
      student,
    });
    payload = result.ok
      ? result.data
      : buildGlobalFallbackAttachmentReview(result.message || "review_unavailable");
  } catch (e) {
    hardFailed = true;
    const msg = e instanceof Error ? e.message : String(e);
    payload = buildGlobalFallbackAttachmentReview(msg);
  }

  const pipelineFailed =
    hardFailed || payload.modelNote === "ATTACHMENT_AI_REVIEW_FAILED";

  const finalPayload: AdminAttachmentAiReviewResult = {
    ...payload,
    aiReviewRunStatus: pipelineFailed ? "failed" : "completed",
    aiReviewInputSignature: signature,
    ...(pipelineFailed ? { aiReviewFailureMessage: String(payload.modelNote || "") } : {}),
  };

  await Achievement.updateOne(
    { _id: new mongoose.Types.ObjectId(achievementId) },
    {
      $set: {
        adminAttachmentAiReview: finalPayload as Record<string, unknown>,
        adminAttachmentOverall: finalPayload.overallMatchStatus,
      },
    }
  );

  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] auto_review_completed", {
    achievementId,
    trigger,
    runStatus: finalPayload.aiReviewRunStatus,
    decision: finalPayload.aiReviewDecision,
    overall: finalPayload.overallMatchStatus,
  });
}
