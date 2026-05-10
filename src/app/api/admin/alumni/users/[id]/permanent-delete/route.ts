import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { executePermanentAlumniPurge } from "@/lib/alumni/admin-alumni-removal";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

const errorReason = (code: string): string => {
  const map: Record<string, string> = {
    INVALID_ID: "Invalid user id",
    CONFIRM_REQUIRED: "Confirmation flag required",
    CONFIRM_PHRASE_REQUIRED: "Confirmation phrase required",
    SELF_DELETE_FORBIDDEN: "Self-delete is not allowed",
    NOT_FOUND: "Target user not found",
    FORBIDDEN_ADMIN_TARGET: "Cannot purge a platform admin account",
    NOT_ALUMNI_ACCOUNT: "Target is not an alumni-linked account",
  };
  return map[code] || code;
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID", reason: errorReason("INVALID_ID") },
        { status: 400 }
      );
    }

    const body = sanitizeMongoShape((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (body.confirm !== true) {
      return NextResponse.json(
        { ok: false, error: "CONFIRM_REQUIRED", reason: errorReason("CONFIRM_REQUIRED") },
        { status: 400 }
      );
    }

    const result = await executePermanentAlumniPurge({
      targetUserId: String(id),
      actorUser: gate.user as unknown as IUser & { _id: mongoose.Types.ObjectId },
      request,
      confirmPhrase: String(body.confirmPhrase || ""),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          reason: errorReason(result.error),
        },
        { status: result.status }
      );
    }

    const already = result.alreadyPurged === true;
    return NextResponse.json({
      ok: true,
      alreadyPurged: already,
      alreadyDeleted: already,
    });
  } catch (error) {
    console.error("[POST permanent-delete]", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_SERVER_ERROR", reason: "Unexpected server error" },
      { status: 500 }
    );
  }
}
