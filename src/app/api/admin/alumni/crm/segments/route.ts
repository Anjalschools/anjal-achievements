import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniRelationshipScore from "@/models/AlumniRelationshipScore";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    await connectDB();
    const rows = await AlumniRelationshipScore.aggregate<{ _id: string; c: number; avg: number }>([
      { $group: { _id: "$segment", c: { $sum: 1 }, avg: { $avg: "$score" } } },
      { $sort: { c: -1 } },
    ]);
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        segment: r._id,
        count: r.c,
        avgScore: Math.round((r.avg || 0) * 10) / 10,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/crm/segments]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
