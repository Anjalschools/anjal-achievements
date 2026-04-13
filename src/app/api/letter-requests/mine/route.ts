import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LetterRequest from "@/models/LetterRequest";
import { requireStudentSession } from "@/lib/letter-request-auth";
import { serializeLetterRequest } from "@/lib/letter-request-api-serialize";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireStudentSession();
  if (!gate.ok) return gate.response;
  const uid = gate.user._id;
  if (!uid || !mongoose.Types.ObjectId.isValid(String(uid))) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    await connectDB();
    const rows = await LetterRequest.find({ userId: uid }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => serializeLetterRequest(r, "student")),
    });
  } catch (e) {
    console.error("[GET /api/letter-requests/mine]", e);
    return jsonInternalServerError(e);
  }
}
