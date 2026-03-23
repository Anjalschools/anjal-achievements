import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { runAiOtherCustomFieldAssist, runAiReviewerNotes } from "@/lib/achievement-ai-assist";
import { isAiAssistEnabled } from "@/lib/openai-env";
import {
  aiFieldInferenceContextFromApiBody,
  buildFieldInferenceInput,
  shouldUseAiFieldInference,
} from "@/lib/achievement-ai-field-eligibility";

export const dynamic = "force-dynamic";

const REVIEWER_ROLES = new Set(["admin", "supervisor", "schoolAdmin", "teacher", "judge"]);

const aiDebug = (msg: string, extra?: Record<string, unknown>) => {
  if (process.env.AI_DEBUG === "1") {
    console.log(`[ai/assist] ${msg}`, extra ?? "");
  }
};

const sanitizeAchievementRecord = (raw: Record<string, unknown>): Record<string, unknown> => {
  const omit = new Set(["passwordHash", "__v"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (omit.has(k)) continue;
    if (k === "description" && typeof v === "string" && v.length > 4000) {
      out[k] = `${v.slice(0, 4000)}…`;
      continue;
    }
    if (k === "attachments" && Array.isArray(v)) {
      out[k] = { count: v.length };
      continue;
    }
    if (k === "image" && typeof v === "string" && v.startsWith("data:")) {
      out[k] = "[image data omitted]";
      continue;
    }
    out[k] = v;
  }
  return out;
};

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ enabled: false });
  }
  return NextResponse.json({ enabled: isAiAssistEnabled() });
}

export async function POST(req: NextRequest) {
  if (!isAiAssistEnabled()) {
    return NextResponse.json(
      { error: "AI assist is disabled or not configured", code: "ai_disabled" },
      { status: 503 }
    );
  }

  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action || "");
  const locale = body.locale === "en" ? "en" : "ar";

  if (action === "other_field_suggest") {
    const ctx = aiFieldInferenceContextFromApiBody(body, locale);

    if (!shouldUseAiFieldInference(ctx)) {
      return NextResponse.json(
        {
          error: "AI field assist is not allowed for this achievement selection",
          code: "ai_not_allowed",
        },
        { status: 403 }
      );
    }

    const modelInput = buildFieldInferenceInput(ctx);
    if (!modelInput) {
      return NextResponse.json({ error: "No text available for field inference" }, { status: 400 });
    }

    const result = await runAiOtherCustomFieldAssist({
      locale,
      customEventName: modelInput,
    });

    if (!result.ok) {
      aiDebug("other_field_suggest_error", { message: result.message });
      return NextResponse.json({ error: result.message, code: "openai_error" }, { status: 502 });
    }

    const d = result.data;
    return NextResponse.json({
      ok: true,
      suggestedField: d.suggestedField,
      confidence: d.confidence,
      noteAr: d.noteAr,
      noteEn: d.noteEn,
    });
  }

  if (action === "reviewer_notes") {
    const role = String((user as { role?: string }).role || "");
    if (!REVIEWER_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const achievementId = String(body.achievementId || "").trim();
    if (!achievementId || !mongoose.Types.ObjectId.isValid(achievementId)) {
      return NextResponse.json({ error: "Invalid achievementId" }, { status: 400 });
    }

    await connectDB();
    const doc = await Achievement.findById(achievementId).lean();
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const safe = sanitizeAchievementRecord(doc as unknown as Record<string, unknown>);
    const result = await runAiReviewerNotes({
      locale,
      achievementJson: safe,
    });

    if (!result.ok) {
      aiDebug("reviewer_notes_error", { message: result.message });
      return NextResponse.json({ error: result.message, code: "openai_error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, data: result.data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
