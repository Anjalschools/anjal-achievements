import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniVerificationRequest from "@/models/AlumniVerificationRequest";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { status?: string; reviewerNotes?: string };
    const status = body.status;
    if (status !== "approved" && status !== "rejected") {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    const reviewerNotes = sanitizeUserText(String(body.reviewerNotes || "")).slice(0, 2000);

    await connectDB();
    const row = await AlumniVerificationRequest.findById(id);
    if (!row) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (row.status !== "pending") {
      return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
    }

    row.status = status;
    row.reviewerNotes = reviewerNotes || undefined;
    row.reviewedById = gate.user._id as mongoose.Types.ObjectId;
    row.reviewedAt = new Date();
    await row.save();

    if (status === "approved") {
      const tier = row.requestedLevel;
      await User.updateOne(
        { _id: row.userId },
        {
          $set: {
            "alumniProfile.isVerifiedAlumni": true,
            "alumniProfile.verificationTier": tier,
            "alumniProfile.verificationSource": "admin",
            "alumniProfile.verifiedAt": new Date(),
            "alumniProfile.verifiedById": gate.user._id,
          },
        }
      );
      try {
        await recomputeAlumniReputationGraph(row.userId);
      } catch (reErr) {
        console.warn("[verification approve] reputation recompute", reErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/admin/alumni/verification-requests/[id]]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
