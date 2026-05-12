import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import AlumniFeedEngagement from "@/models/AlumniFeedEngagement";
import { resolveFeedEngagementTargetOwner } from "@/lib/alumni/feed-engage-resolve";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["like", "save", "share"]);

export async function POST(request: NextRequest) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;
  const blocked = requireAlumniCommunityForAuthedUser(gate.user);
  if (blocked) return blocked;

  let body: { kind?: string; targetId?: string; action?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const kind = String(body.kind || "").trim().toLowerCase();
  const targetId = String(body.targetId || "").trim();
  const action = String(body.action || "").trim().toLowerCase();

  if (!kind || !targetId || !ACTIONS.has(action)) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  try {
    await connectDB();
    const actorId = new mongoose.Types.ObjectId(gate.userId);
    const targetOwnerId = await resolveFeedEngagementTargetOwner(kind, targetId);
    if (!targetOwnerId) {
      return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });
    }

    if (action === "share") {
      await AlumniFeedEngagement.create({
        actorId,
        targetKind: kind,
        targetId,
        targetOwnerId,
        action: "share",
      });
      return NextResponse.json({ ok: true });
    }

    await AlumniFeedEngagement.findOneAndUpdate(
      { actorId, targetKind: kind, targetId, action },
      { $set: { targetOwnerId } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/alumni/community-feed/engage]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
