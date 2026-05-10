import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { executeCommunitySoftRemove } from "@/lib/alumni/admin-alumni-removal";
import type { IUser } from "@/models/User";

/**
 * Backward-compatible alias: some clients POST here with `{ userId, confirm }`
 * instead of `/api/admin/alumni/users/[id]/community-soft-remove`.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    const body = sanitizeMongoShape((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (body.confirm !== true) {
      return NextResponse.json({ error: "CONFIRM_REQUIRED" }, { status: 400 });
    }
    const userId = String(body.userId || body.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }

    const result = await executeCommunitySoftRemove({
      targetUserId: userId,
      actorUser: gate.user as unknown as IUser & { _id: mongoose.Types.ObjectId },
      request,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, alreadyRemoved: result.alreadyRemoved });
  } catch (error) {
    console.error("[POST /api/admin/alumni/community-soft-remove]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
