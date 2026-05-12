import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { getExecutiveNetworkIntelligence } from "@/lib/alumni/analytics/executive-network-intelligence";
import { getAlumniNetworkIntelligenceV1 } from "@/lib/alumni/analytics/network-intelligence-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const [executive, metricsV1] = await Promise.all([getExecutiveNetworkIntelligence(), getAlumniNetworkIntelligenceV1()]);
    return NextResponse.json({ ok: true, executive, metricsV1 });
  } catch (error) {
    console.error("[GET /api/admin/alumni/network-intelligence]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
