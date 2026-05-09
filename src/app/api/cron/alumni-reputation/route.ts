import { NextRequest, NextResponse } from "next/server";
import { batchRecomputeAlumniReputation } from "@/lib/alumni/reputation-graph/recompute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Periodic reputation graph refresh — Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limit = Math.min(300, Math.max(10, Number(request.nextUrl.searchParams.get("limit")) || 80));
    const { updated } = await batchRecomputeAlumniReputation(limit);
    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    console.error("[cron/alumni-reputation]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
