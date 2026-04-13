import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import { isAiAssistEnabled, logOpenAiRuntimeDiagnostics } from "@/lib/openai-env";
import {
  buildGlobalFallbackAttachmentReview,
  runAdminAchievementAttachmentAiReview,
} from "@/lib/achievement-admin-attachment-ai";
import { applyDeterministicAttachmentReviewDecision } from "@/lib/attachment-ai-decision-engine";
import { computeAiReviewInputSignature } from "@/lib/attachment-ai-review-signature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  // eslint-disable-next-line no-console
  console.log("[AI_REVIEW] step: start", { id });

  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  logOpenAiRuntimeDiagnostics("POST /api/admin/achievements/[id]/attachment-ai-review");

  if (!isAiAssistEnabled()) {
    return NextResponse.json(
      { error: "AI assist is disabled or not configured", code: "ai_disabled" },
      { status: 503 }
    );
  }

  const adminId = String(gate.user._id);
  let achievementLean: Record<string, unknown> | null = null;

  try {
    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] step: load_achievement", id);
    await connectDB();

    const doc = await Achievement.findById(id)
      .populate("userId", "fullName fullNameAr fullNameEn email")
      .lean();

    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const a = doc as unknown as Record<string, unknown>;
    achievementLean = a;
    const user = a.userId as Record<string, unknown> | null;

    const student =
      user && typeof user === "object"
        ? {
            fullName: String(user.fullName || user.fullNameAr || ""),
            fullNameAr: user.fullNameAr ? String(user.fullNameAr) : undefined,
            fullNameEn: user.fullNameEn ? String(user.fullNameEn) : undefined,
          }
        : null;

    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] step: collect_attachments_and_review");
    const result = await runAdminAchievementAttachmentAiReview({
      achievement: a,
      student,
    });

    const data = result.ok ? result.data : buildGlobalFallbackAttachmentReview(result.message || "review_unavailable");
    const signature = computeAiReviewInputSignature(a);

    const payload = {
      ...data,
      analyzedByAdminId: adminId,
      aiReviewRunStatus: "completed" as const,
      aiReviewInputSignature: signature,
    };

    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] step: persist_review", { overall: payload.overallMatchStatus });

    await Achievement.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          adminAttachmentAiReview: payload,
          adminAttachmentOverall: payload.overallMatchStatus,
        },
      }
    );

    // eslint-disable-next-line no-console
    console.log("[AI_REVIEW] step: done", { ok: true });

    return NextResponse.json({
      ok: true,
      review: payload,
      adminAttachmentOverall: payload.overallMatchStatus,
    });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ATTACHMENT_AI_REVIEW_ERROR]", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    const sig = computeAiReviewInputSignature(achievementLean || {});
    const fallback = {
      ...applyDeterministicAttachmentReviewDecision(buildGlobalFallbackAttachmentReview(message), {
        record: achievementLean || {},
        pdfReliabilityLow: true,
      }),
      analyzedByAdminId: adminId,
      aiReviewRunStatus: "failed" as const,
      aiReviewInputSignature: sig,
      aiReviewFailureMessage: message,
    };

    try {
      await connectDB();
      await Achievement.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        {
          $set: {
            adminAttachmentAiReview: fallback,
            adminAttachmentOverall: fallback.overallMatchStatus,
          },
        }
      );
    } catch (persistErr) {
      // eslint-disable-next-line no-console
      console.error("[ATTACHMENT_AI_REVIEW_ERROR] persist_fallback_failed", persistErr);
    }

    return NextResponse.json(
      {
        ok: false,
        error: "ATTACHMENT_AI_REVIEW_FAILED",
        message,
        review: fallback,
        adminAttachmentOverall: fallback.overallMatchStatus,
      },
      { status: 200 }
    );
  }
}
