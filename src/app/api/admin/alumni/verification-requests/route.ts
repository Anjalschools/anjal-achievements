import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniVerificationRequest from "@/models/AlumniVerificationRequest";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeUserText } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const sp = request.nextUrl.searchParams;
    const status = String(sp.get("status") || "all");
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;
    const q = sanitizeUserText(String(sp.get("q") || ""));

    const filter: Record<string, unknown> = {};
    if (status === "pending" || status === "approved" || status === "rejected") {
      filter.status = status;
    }

    if (q) {
      const clauses: Record<string, unknown>[] = [];
      if (mongoose.isValidObjectId(q)) {
        clauses.push({ userId: new mongoose.Types.ObjectId(q) });
      }
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const users = await User.find({ fullName: rx }).select("_id").limit(80).lean();
      const ids = users.map((u) => u._id);
      if (ids.length) clauses.push({ userId: { $in: ids } });
      if (!clauses.length) {
        return NextResponse.json({
          ok: true,
          total: 0,
          page,
          limit,
          pendingCount: await AlumniVerificationRequest.countDocuments({ status: "pending" }),
          items: [],
        });
      }
      filter.$or = clauses;
    }

    const [rows, total, pendingCount] = await Promise.all([
      AlumniVerificationRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AlumniVerificationRequest.countDocuments(filter),
      AlumniVerificationRequest.countDocuments({ status: "pending" }),
    ]);

    const userIds = [...new Set(rows.map((r) => String(r.userId)))];
    const users = await User.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select("fullName email alumniProfile.isVerifiedAlumni alumniProfile.verificationTier")
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));

    return NextResponse.json({
      ok: true,
      total,
      page,
      limit,
      pendingCount,
      items: rows.map((r) => {
        const u = byId.get(String(r.userId));
        return {
          id: r._id.toString(),
          userId: String(r.userId),
          fullName: u?.fullName || "",
          email: u?.email || "",
          requestedLevel: r.requestedLevel,
          status: r.status,
          attachments: r.attachments,
          aiValidationScore: r.aiValidationScore,
          aiNotes: r.aiNotes,
          reviewerNotes: r.reviewerNotes,
          reviewedAt: r.reviewedAt,
          createdAt: r.createdAt,
          currentTier: u?.alumniProfile?.verificationTier || null,
          isVerifiedAlumni: u?.alumniProfile?.isVerifiedAlumni === true,
        };
      }),
    });
  } catch (e) {
    console.error("[GET /api/admin/alumni/verification-requests]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
