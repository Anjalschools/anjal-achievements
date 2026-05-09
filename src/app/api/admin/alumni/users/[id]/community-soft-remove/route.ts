import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import { deleteAlumniIntelCacheKey } from "@/lib/alumni/alumni-intelligence-cache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }

    const body = sanitizeMongoShape((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (body.confirm !== true) {
      return NextResponse.json({ error: "CONFIRM_REQUIRED" }, { status: 400 });
    }

    await connectDB();
    const uid = new mongoose.Types.ObjectId(id);
    const user = await User.findById(uid).select("email accountType alumniCommunityRemovedAt fullName fullNameAr").lean();
    if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (String((user as { accountType?: string }).accountType || "") !== "alumni") {
      return NextResponse.json({ error: "NOT_ALUMNI_ACCOUNT" }, { status: 400 });
    }
    if ((user as { alumniCommunityRemovedAt?: Date }).alumniCommunityRemovedAt) {
      return NextResponse.json({ error: "ALREADY_REMOVED" }, { status: 409 });
    }

    await User.updateOne(
      { _id: uid },
      {
        $set: {
          alumniCommunityRemovedAt: new Date(),
          alumniCommunityRemovedById: gate.user._id,
        },
      }
    );

    deleteAlumniIntelCacheKey("crm:overview:v1");
    invalidateSessionUserCache(id, String((user as { email?: string }).email || ""));

    await logAuditEvent({
      actionType: "alumni.community_soft_remove",
      entityType: "User",
      entityId: id,
      entityTitle: String((user as { fullNameAr?: string; fullName?: string }).fullNameAr || (user as { fullName?: string }).fullName || ""),
      descriptionAr: "إزالة خريج من ظهور مجتمع الخريجين (حذف ناعم)",
      actor: actorFromUser(gate.user as unknown as Parameters<typeof actorFromUser>[0]),
      request,
      outcome: "success",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST community-soft-remove]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
