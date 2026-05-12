import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { buildCommunityFeedItems } from "@/lib/alumni/community-feed-service";

export const dynamic = "force-dynamic";

/** Same stream as `/api/alumni/community-feed` with admin deep links (alumni staff / alumniAdmin). */
export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const items = await buildCommunityFeedItems("admin", 32);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[GET /api/admin/alumni/community-feed]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
