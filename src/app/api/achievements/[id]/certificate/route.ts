import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import {
  canStudentViewCertificate,
  isCertificateVerificationChainOk,
} from "@/lib/certificate-eligibility";
import {
  buildCertificateSnapshot,
  type AppreciationCertificateSnapshot,
  snapshotToCertificateProps,
} from "@/lib/certificate-content";
import User from "@/models/User";
import { isLegacyCertificateRecord } from "@/lib/certificate-eligibility";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

const REVIEWER_VIEW_ROLES = new Set(["admin", "schoolAdmin", "supervisor", "teacher", "judge"]);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    if (!params.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
    }

    const currentUser = await getCurrentDbUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized - Please login" }, { status: 401 });
    }

    const achievement = await Achievement.findById(params.id).lean();
    if (!achievement) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }

    const a = achievement as unknown as Record<string, unknown>;
    const ownerId = String(a.userId || "");
    const isOwner = ownerId === String(currentUser._id);
    const role = String(currentUser.role || "");
    const isReviewer = REVIEWER_VIEW_ROLES.has(role);

    if (!isOwner && !isReviewer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const like = achievement as Parameters<typeof canStudentViewCertificate>[0];
    if (!canStudentViewCertificate(like)) {
      return NextResponse.json(
        { error: "Certificate not available", code: "CERTIFICATE_NOT_AVAILABLE" },
        { status: 403 }
      );
    }

    const snap = a.certificateSnapshot as AppreciationCertificateSnapshot | undefined;
    const token = String(a.certificateVerificationToken || "").trim();

    if (!isCertificateVerificationChainOk(like)) {
      return NextResponse.json({ error: "Certificate is not valid" }, { status: 403 });
    }

    let content;
    if (snap && (snap.schemaVersion === 2 || snap.schemaVersion === 3)) {
      content = snapshotToCertificateProps(snap);
    } else if (isLegacyCertificateRecord(like)) {
      const u = await User.findById(a.userId).lean();
      if (!u) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const ver =
        typeof a.certificateVersion === "number" && Number.isFinite(a.certificateVersion)
          ? Math.max(1, a.certificateVersion)
          : 1;
      const synthetic = buildCertificateSnapshot(a, u as unknown as Record<string, unknown>, ver);
      content = snapshotToCertificateProps(synthetic);
    } else {
      return NextResponse.json(
        { error: "Certificate data missing — contact support" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      achievementId: params.id,
      verifyPath: token ? `/verify/certificate/${token}` : null,
      certificateId: a.certificateId ?? null,
      certificateVersion:
        typeof a.certificateVersion === "number" ? a.certificateVersion : snap?.certificateVersion ?? 1,
      content,
    });
  } catch (error) {
    console.error("[GET achievement certificate]", error);
    return jsonInternalServerError(error);
  }
}
