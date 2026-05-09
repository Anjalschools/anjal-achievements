import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { computeAlumniReputationScore } from "@/lib/alumni/reputation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as { userId?: string; batchLimit?: number };
    await connectDB();

    if (body.userId && mongoose.isValidObjectId(body.userId)) {
      const oid = new mongoose.Types.ObjectId(body.userId);
      const score = await computeAlumniReputationScore(oid);
      await User.updateOne({ _id: oid }, { $set: { "alumniProfile.reputationScore": score } });
      return NextResponse.json({ ok: true, userId: body.userId, reputationScore: score });
    }

    const limit = Math.min(400, Math.max(1, Number(body.batchLimit) || 120));
    const rows = await User.find({ accountType: "alumni" })
      .select("_id")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    let updated = 0;
    for (const row of rows) {
      const oid = row._id as mongoose.Types.ObjectId;
      const score = await computeAlumniReputationScore(oid);
      await User.updateOne({ _id: oid }, { $set: { "alumniProfile.reputationScore": score } });
      updated += 1;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("[POST /api/admin/alumni/reputation]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
