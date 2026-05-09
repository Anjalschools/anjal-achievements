import { NextRequest, NextResponse } from "next/server";
import { runAlumniAutomationCycle } from "@/lib/alumni/automation/run-scheduled-scan";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Worker endpoint — call from Vercel Cron / Cloud Scheduler with Authorization: Bearer CRON_SECRET.
 * Processes queued jobs + lightweight lifecycle scans (queue-ready; swap body for BullMQ consumer later).
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
    const limit = Math.min(100, Math.max(5, Number(request.nextUrl.searchParams.get("limit")) || 25));
    const result = await runAlumniAutomationCycle(limit);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[cron/alumni-automation]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
