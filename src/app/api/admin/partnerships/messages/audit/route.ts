import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireAdmin } from "@/lib/auth-guard";
import { listPartnershipMessageAudit } from "@/lib/partnerships/partnership-message-mutation-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const threadId = request.nextUrl.searchParams.get("threadId")?.trim() || undefined;
  const messageId = request.nextUrl.searchParams.get("messageId")?.trim() || undefined;
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 100;

  try {
    const items = await listPartnershipMessageAudit({
      threadId,
      messageId,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/messages/audit]", error);
    return jsonInternalServerError(error);
  }
}
