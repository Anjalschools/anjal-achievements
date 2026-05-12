import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { requireAlumniCommunityForAuthedUser } from "@/lib/alumni/require-alumni-community-access";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { buildCommunityFeedItems } from "@/lib/alumni/community-feed-service";

export const dynamic = "force-dynamic";

/**
 * Lightweight mixed activity stream (v1) — foundation for a richer community feed.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;
  const blocked = requireAlumniCommunityForAuthedUser(gate.user);
  if (blocked) return blocked;

  if (!(await checkRouteRateLimit(request, "/api/alumni/community-feed"))) {
    return rateLimitExceededResponse();
  }

  try {
    await connectDB();
    const items = await buildCommunityFeedItems("alumni", 24);
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[GET /api/alumni/community-feed]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
