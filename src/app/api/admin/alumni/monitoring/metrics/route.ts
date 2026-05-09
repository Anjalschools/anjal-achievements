import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { getMetricsSummary } from "@/lib/alumni/monitoring/metrics";
import { getDeliveryCounters } from "@/lib/alumni/monitoring/delivery-monitor";
import { snapshotRecommendationCacheEntries } from "@/lib/alumni/monitoring/recommendations-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    await connectDB();
    return NextResponse.json({
      ok: true,
      metrics: getMetricsSummary(),
      delivery: getDeliveryCounters(),
      recommendationsCacheProbe: snapshotRecommendationCacheEntries(),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/monitoring/metrics]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
