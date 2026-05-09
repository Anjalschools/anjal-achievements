import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { executePermanentAlumniPurge } from "@/lib/alumni/admin-alumni-removal";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }

    const body = sanitizeMongoShape((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (body.confirm !== true) {
      return NextResponse.json({ error: "CONFIRM_REQUIRED" }, { status: 400 });
    }

    const result = await executePermanentAlumniPurge({
      targetUserId: String(id),
      actorUser: gate.user as unknown as IUser & { _id: mongoose.Types.ObjectId },
      request,
      confirmPhrase: String(body.confirmPhrase || ""),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, alreadyPurged: result.alreadyPurged });
  } catch (error) {
    console.error("[POST permanent-delete]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
