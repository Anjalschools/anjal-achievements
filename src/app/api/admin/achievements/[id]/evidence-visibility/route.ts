import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { normalizeAttachmentsArray } from "@/lib/achievement-attachments";
import { requireAchievementReviewerForAchievementId } from "@/lib/review-auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const id = String(params.id || "").trim();
  const gate = await requireAchievementReviewerForAchievementId(id);
  if (!gate.ok) return gate.response;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { items?: Array<{ index: number; showInPublicPortfolio: boolean }> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  await connectDB();
  const doc = await Achievement.findById(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachments = normalizeAttachmentsArray(doc.attachments);
  for (const item of items) {
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= attachments.length) {
      return NextResponse.json({ error: "Invalid attachment index" }, { status: 400 });
    }
    const showPublic = item.showInPublicPortfolio === true;
    attachments[item.index] = {
      ...attachments[item.index],
      approved: showPublic,
      showInPublicPortfolio: showPublic,
    };
  }

  doc.attachments = attachments;
  await doc.save();

  return NextResponse.json({
    ok: true,
    attachments: attachments.map((attachment, index) => ({
      index,
      name: attachment.name,
      approved: attachment.approved === true,
      showInPublicPortfolio: attachment.showInPublicPortfolio === true,
    })),
  });
}
