import { NextRequest, NextResponse } from "next/server";
import { buildPartnerAccessPayload } from "@/lib/partnerships/partner-access-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { token: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const token = String(params.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    const payload = await buildPartnerAccessPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired access link" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error("[GET /api/partner-access/[token]]", error);
    return jsonInternalServerError(error);
  }
}
