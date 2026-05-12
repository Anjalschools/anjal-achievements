import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniRecommendationInteraction from "@/models/AlumniRecommendationInteraction";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import type {
  RecommendationInteractionAction,
  RecommendationInteractionSurface,
} from "@/models/AlumniRecommendationInteraction";

export const dynamic = "force-dynamic";

const SURFACES = new Set<RecommendationInteractionSurface>(["recommendations_v1", "feed", "mentor_match"]);
const ACTIONS = new Set<RecommendationInteractionAction>(["expose", "click", "dismiss", "accept"]);

export async function POST(request: NextRequest) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;
  const denied = requireAlumniCommunityForAuthedUser(gate.user);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      surface?: string;
      kind?: string;
      targetId?: string;
      action?: string;
    };
    const surface = body.surface as RecommendationInteractionSurface | undefined;
    const action = body.action as RecommendationInteractionAction | undefined;
    const kind = typeof body.kind === "string" ? body.kind.trim().slice(0, 48) : "";
    const targetId = typeof body.targetId === "string" ? body.targetId.trim().slice(0, 80) : "";

    if (!surface || !SURFACES.has(surface)) {
      return NextResponse.json({ error: "INVALID_SURFACE" }, { status: 400 });
    }
    if (!action || !ACTIONS.has(action)) {
      return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
    }
    if (!kind || !targetId) {
      return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    await connectDB();
    await AlumniRecommendationInteraction.create({
      userId: new mongoose.Types.ObjectId(String(gate.user._id)),
      surface,
      kind,
      targetId,
      action,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/alumni/recommendations/track]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
