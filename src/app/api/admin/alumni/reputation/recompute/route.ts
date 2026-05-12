import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { batchRecomputeAlumniReputation, recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json().catch(() => ({}))) as { userId?: string; limit?: number };
    await connectDB();

    if (body.userId && mongoose.isValidObjectId(body.userId)) {
      const oid = new mongoose.Types.ObjectId(body.userId);
      const data = await recomputeAlumniReputationGraph(oid);
      return NextResponse.json({ ok: true, mode: "single", data });
    }

    const limit = Math.min(500, Math.max(1, Number(body.limit) || 150));
    const { updated } = await batchRecomputeAlumniReputation(limit);
    return NextResponse.json({ ok: true, mode: "batch", updated });
  } catch (e) {
    console.error("[POST /api/admin/alumni/reputation/recompute]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
