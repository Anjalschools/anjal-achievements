import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import type { AlumniVerificationSource } from "@/models/User";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";

export const dynamic = "force-dynamic";

const SOURCES: AlumniVerificationSource[] = ["linkedin", "admin", "university_email", "career"];

export async function POST(request: Request) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as {
      userId?: string;
      isVerifiedAlumni?: boolean;
      verificationSource?: AlumniVerificationSource;
    };
    const userId = body.userId;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: "INVALID_USER_ID" }, { status: 400 });
    }

    const verified = Boolean(body.isVerifiedAlumni);
    const src = body.verificationSource;
    if (verified && src && !SOURCES.includes(src)) {
      return NextResponse.json({ error: "INVALID_SOURCE" }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(userId).select("accountType").lean();
    if (!user || (user as any).accountType !== "alumni") {
      return NextResponse.json({ error: "ALUMNI_PROFILE_REQUIRED" }, { status: 400 });
    }

    if (verified) {
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            "alumniProfile.isVerifiedAlumni": true,
            "alumniProfile.verifiedAt": new Date(),
            "alumniProfile.verifiedById": gate.user._id,
            "alumniProfile.verificationSource": src || "admin",
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: userId },
        {
          $set: { "alumniProfile.isVerifiedAlumni": false },
          $unset: {
            "alumniProfile.verifiedAt": 1,
            "alumniProfile.verifiedById": 1,
            "alumniProfile.verificationSource": 1,
          },
        }
      );
    }

    await logAuditEvent({
      actionType: "alumni.verification",
      entityType: "User",
      entityId: String(userId),
      descriptionAr: verified ? "تم توثيق الخريج من لوحة الإدارة" : "تم إلغاء توثيق الخريج",
      metadata: { verified, verificationSource: src || "admin" },
      actor: actorFromUser(gate.user),
      outcome: "success",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/admin/alumni/verification]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
