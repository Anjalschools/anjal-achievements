import { NextRequest, NextResponse } from "next/server";
import { updateHomeStats } from "@/lib/home-stats-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Periodic recompute for homepage stats (e.g. Vercel Cron every 60s).
 * Set CRON_SECRET and call with: Authorization: Bearer <CRON_SECRET>
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
    await updateHomeStats();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cron/home-stats]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
