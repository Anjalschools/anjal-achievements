import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import type { IUser } from "@/models/User";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import { resolveAchievementTitleForAdmin } from "@/lib/admin-achievement-labels";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  let body: { showInPublicPortfolio?: boolean; showInHallOfFame?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasPortfolio = typeof body.showInPublicPortfolio === "boolean";
  const hasHof = typeof body.showInHallOfFame === "boolean";
  if (!hasPortfolio && !hasHof) {
    return NextResponse.json({ error: "No visibility fields provided" }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await Achievement.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const before = {
      showInPublicPortfolio: doc.showInPublicPortfolio === true,
      showInHallOfFame: doc.showInHallOfFame !== false,
      publicPortfolioSuppressedByAdmin: doc.publicPortfolioSuppressedByAdmin === true,
    };

    if (hasPortfolio) {
      if (body.showInPublicPortfolio) {
        doc.publicPortfolioSuppressedByAdmin = false;
        doc.showInPublicPortfolio = true;
      } else {
        doc.publicPortfolioSuppressedByAdmin = true;
        doc.showInPublicPortfolio = false;
      }
    }

    if (hasHof) {
      doc.showInHallOfFame = body.showInHallOfFame === true;
    }

    await doc.save();

    const after = {
      showInPublicPortfolio: doc.showInPublicPortfolio === true,
      showInHallOfFame: doc.showInHallOfFame !== false,
      publicPortfolioSuppressedByAdmin: doc.publicPortfolioSuppressedByAdmin === true,
    };

    const titleAr = resolveAchievementTitleForAdmin(doc.toObject() as unknown as Record<string, unknown>, "ar");

    await logAuditEvent({
      actionType: "achievement_visibility_updated",
      entityType: "achievement",
      entityId: id,
      entityTitle: titleAr,
      descriptionAr: "تحديث ظهور الإنجاز في ملف الإنجاز العام أو لوحة التميز",
      before,
      after,
      metadata: {
        showInPublicPortfolioPatched: hasPortfolio,
        showInHallOfFamePatched: hasHof,
      },
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({
      success: true,
      showInPublicPortfolio: after.showInPublicPortfolio,
      showInHallOfFame: after.showInHallOfFame,
      publicPortfolioSuppressedByAdmin: after.publicPortfolioSuppressedByAdmin,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[PATCH achievement visibility]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
