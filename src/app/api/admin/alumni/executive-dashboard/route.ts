import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { getExecutiveAlumniDashboard } from "@/lib/alumni/executive-alumni-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const data = await getExecutiveAlumniDashboard();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/admin/alumni/executive-dashboard]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
