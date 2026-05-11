import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { normalizeOpportunityStatus } from "@/lib/alumni/normalize-opportunity-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const uid = new mongoose.Types.ObjectId(gate.userId);
    const rows = await AlumniOpportunity.find({ createdByUserId: uid })
      .select("title type company published reviewStatus archivedAt createdAt updatedAt applicationUrl")
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        title: row.title || "",
        type: row.type,
        company: row.company || null,
        published: row.published === true,
        reviewStatus: normalizeOpportunityStatus(row),
        archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        applicationUrl: row.applicationUrl || null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/alumni/my-opportunities]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
