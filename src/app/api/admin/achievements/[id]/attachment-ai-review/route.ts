import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";
import { isAiAssistEnabled } from "@/lib/openai-env";
import { runAdminAchievementAttachmentAiReview } from "@/lib/achievement-admin-attachment-ai";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const id = params.id;
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;

  if (!isAiAssistEnabled()) {
    return NextResponse.json(
      { error: "AI assist is disabled or not configured", code: "ai_disabled" },
      { status: 503 }
    );
  }

  try {
    await connectDB();

    const doc = await Achievement.findById(id)
      .populate("userId", "fullName fullNameAr fullNameEn email")
      .lean();

    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const a = doc as unknown as Record<string, unknown>;
    const user = a.userId as Record<string, unknown> | null;

    const student =
      user && typeof user === "object"
        ? {
            fullName: String(user.fullName || user.fullNameAr || ""),
            fullNameAr: user.fullNameAr ? String(user.fullNameAr) : undefined,
            fullNameEn: user.fullNameEn ? String(user.fullNameEn) : undefined,
          }
        : null;

    const result = await runAdminAchievementAttachmentAiReview({
      achievement: a,
      student,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: "openai_error" },
        { status: 502 }
      );
    }

    const payload = {
      ...result.data,
      analyzedByAdminId: String(gate.user._id),
    };

    await Achievement.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          adminAttachmentAiReview: payload,
          adminAttachmentOverall: payload.overallMatchStatus,
        },
      }
    );

    return NextResponse.json({
      ok: true,
      review: payload,
      adminAttachmentOverall: payload.overallMatchStatus,
    });
  } catch (e) {
    console.error("[POST attachment-ai-review]", e);
    return jsonInternalServerError(e);
  }
}