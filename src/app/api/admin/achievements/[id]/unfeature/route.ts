import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    doc.set("isFeatured", false);
    doc.set("featuredAt", undefined);
    await doc.save();

    return NextResponse.json({
      success: true,
      id: doc._id.toString(),
      isFeatured: false,
      status: doc.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH unfeature]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
