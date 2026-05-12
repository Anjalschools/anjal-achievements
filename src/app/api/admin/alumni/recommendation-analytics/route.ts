import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniRecommendationInteraction from "@/models/AlumniRecommendationInteraction";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const since = new Date(Date.now() - 30 * 86400000);
    const rows = await AlumniRecommendationInteraction.aggregate<{ _id: { k: string; a: string }; c: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { k: "$kind", a: "$action" }, c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 200 },
    ]);

    const bySurface = await AlumniRecommendationInteraction.aggregate<{ _id: string; c: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$surface", c: { $sum: 1 } } },
    ]);

    return NextResponse.json({
      ok: true,
      windowDays: 30,
      byKindAction: rows.map((r) => ({ kind: r._id.k, action: r._id.a, count: r.c })),
      bySurface: bySurface.map((r) => ({ surface: r._id, count: r.c })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/recommendation-analytics]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
