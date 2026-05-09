import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAcademicAdvisorEligibleSession } from "@/lib/alumni/require-alumni";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { runAlumniAssistantRecommend } from "@/lib/alumni/ai/recommend-engine";
import type { AlumniAssistantIntent } from "@/lib/alumni/ai/types";

export const dynamic = "force-dynamic";

const INTENTS: AlumniAssistantIntent[] = [
  "mentor_suggest",
  "opportunity_pick",
  "university_explorer",
  "career_insight",
  "network_suggest",
];

export async function POST(request: Request) {
  const gate = await requireAcademicAdvisorEligibleSession();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as {
      intent?: string;
      focus?: string;
      profileOverlay?: Record<string, unknown>;
    };
    const intent = body.intent as AlumniAssistantIntent;
    if (!intent || !INTENTS.includes(intent)) {
      return NextResponse.json({ error: "INVALID_INTENT" }, { status: 400 });
    }

    await connectDB();
    const uid = String(gate.user._id);
    const me = await User.findById(uid).select("alumniProfile lastLoginAt").lean();
    const viewer = buildViewerMatchProfile(me as any, undefined);

    const payload = await runAlumniAssistantRecommend(intent, viewer, {
      selfUserId: uid,
      focus: typeof body.focus === "string" ? body.focus : undefined,
      profileOverlay: body.profileOverlay as any,
    });

    return NextResponse.json({
      ok: true,
      engine: "internal",
      intent,
      data: payload,
    });
  } catch (error) {
    console.error("[POST /api/alumni/assistant/recommend]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
