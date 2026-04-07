import { NextResponse } from "next/server";
import { getScoringConfig } from "@/lib/getScoringConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Read-only public scoring table for transparent UI (same data as admin scoring defaults + overrides). */
export async function GET() {
  try {
    const data = await getScoringConfig(false);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[GET /api/public/scoring-config]", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
