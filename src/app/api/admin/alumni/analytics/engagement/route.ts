import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { getAdminAlumniEngagementIntel } from "@/lib/alumni/admin-alumni-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const data = await getAdminAlumniEngagementIntel();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/admin/alumni/analytics/engagement]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
