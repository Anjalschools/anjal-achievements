import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniVerificationRequest from "@/models/AlumniVerificationRequest";
import User from "@/models/User";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";
import {
  buildVerificationRequestStatusMongoFilter,
  normalizeVerificationStatus,
  parseVerificationRequestListStatusParam,
} from "@/lib/alumni/normalizeVerificationStatus";

const TICKET_LEAN = { virtuals: false as const };

export const dynamic = "force-dynamic";

type LeanUser = {
  _id: mongoose.Types.ObjectId;
  fullName?: string;
  fullNameAr?: string;
  fullNameEn?: string;
  email?: string;
  username?: string;
  updatedAt?: Date;
  createdAt?: Date;
  alumniProfile?: {
    isVerifiedAlumni?: boolean;
    verificationTier?: string;
    verifiedAt?: Date;
    verificationSource?: string;
    graduationYear?: number;
    universityName?: string;
  };
};

const USER_TICKET_SELECT =
  "fullName fullNameAr fullNameEn email username alumniProfile.isVerifiedAlumni alumniProfile.verificationTier alumniProfile.verifiedAt alumniProfile.verificationSource alumniProfile.graduationYear alumniProfile.universityName";

const mapRequestRow = (r: Record<string, unknown>, byId: Map<string, LeanUser>) => {
  const rid = r._id as mongoose.Types.ObjectId;
  const uid = r.userId as mongoose.Types.ObjectId;
  const u = byId.get(String(uid));
  const rawStatus = r.status;
  return {
    id: rid.toString(),
    userId: String(uid),
    fullName: u?.fullName || u?.fullNameAr || u?.fullNameEn || "",
    email: u?.email || "",
    requestedLevel: String(r.requestedLevel || ""),
    status: normalizeVerificationStatus(rawStatus),
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    aiValidationScore: typeof r.aiValidationScore === "number" ? r.aiValidationScore : undefined,
    aiNotes: typeof r.aiNotes === "string" ? r.aiNotes : undefined,
    reviewerNotes: typeof r.reviewerNotes === "string" ? r.reviewerNotes : undefined,
    reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt : undefined,
    createdAt: r.createdAt instanceof Date ? r.createdAt : undefined,
    currentTier: u?.alumniProfile?.verificationTier || null,
    isVerifiedAlumni: u?.alumniProfile?.isVerifiedAlumni === true,
    verificationSource: u?.alumniProfile?.verificationSource || null,
    isProfileOnly: false,
  };
};

export async function GET(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const sp = request.nextUrl.searchParams;
    const statusRaw = String(sp.get("status") || "all");
    const statusNorm = parseVerificationRequestListStatusParam(statusRaw);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;
    const q = sanitizeUserText(String(sp.get("q") || "")).trim();
    const qLower = q.toLowerCase();

    const statusFilter = buildVerificationRequestStatusMongoFilter(statusNorm);
    const filter: Record<string, unknown> = { ...statusFilter };

    if (q) {
      const clauses: Record<string, unknown>[] = [];
      if (mongoose.isValidObjectId(q)) {
        clauses.push({ userId: new mongoose.Types.ObjectId(q) });
      }
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      const year = /^\d{4}$/.test(q) ? parseInt(q, 10) : NaN;
      const userOr: Record<string, unknown>[] = [
        { fullName: rx },
        { fullNameAr: rx },
        { fullNameEn: rx },
        { email: rx },
        { username: rx },
        { "alumniProfile.universityName": rx },
      ];
      if (Number.isFinite(year) && year >= 1950 && year <= 2100) {
        userOr.push({ "alumniProfile.graduationYear": year });
      }
      if (mongoose.isValidObjectId(q)) {
        userOr.push({ _id: new mongoose.Types.ObjectId(q) });
      }
      if (qLower.includes("@")) {
        userOr.push({ email: qLower });
      }
      const users = await User.find({ $or: userOr })
        .select("_id")
        .limit(200)
        .lean(TICKET_LEAN);
      const ids = users.map((u) => u._id as mongoose.Types.ObjectId);
      if (ids.length) clauses.push({ userId: { $in: ids } });
      if (clauses.length) {
        filter.$or = clauses;
      } else {
        filter._id = { $in: [] };
      }
    }

    const [rows, totalTickets, pendingCount] = await Promise.all([
      AlumniVerificationRequest.find(filter)
        .select(
          "userId requestedLevel status attachments aiValidationScore aiNotes reviewerNotes reviewedAt createdAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(TICKET_LEAN),
      AlumniVerificationRequest.countDocuments(filter),
      AlumniVerificationRequest.countDocuments(buildVerificationRequestStatusMongoFilter("pending")),
    ]);

    const userIds = [...new Set(rows.map((r) => String(r.userId)))];
    const users =
      userIds.length > 0
        ? await User.find({ _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } })
            .select(USER_TICKET_SELECT)
            .lean(TICKET_LEAN)
        : [];
    const byId = new Map(users.map((u) => [u._id.toString(), u as LeanUser]));

    let items = rows.map((r) => mapRequestRow(r as unknown as Record<string, unknown>, byId));

    let profileSupplement: Array<Record<string, unknown>> = [];
    if (!q && (statusNorm === "approved" || statusNorm === "all") && page === 1) {
      const ticketUserIds = await AlumniVerificationRequest.distinct("userId");
      const ticketOid = ticketUserIds.map((id) => new mongoose.Types.ObjectId(String(id)));
      const profileUsers = await User.find({
        "alumniProfile.isVerifiedAlumni": true,
        _id: { $nin: ticketOid },
        ...alumniCommunityActiveUserClause(),
      })
        .select(
          "fullName fullNameAr fullNameEn email updatedAt createdAt alumniProfile.isVerifiedAlumni alumniProfile.verificationTier alumniProfile.verifiedAt alumniProfile.verificationSource"
        )
        .sort({ "alumniProfile.verifiedAt": -1, updatedAt: -1 })
        .limit(40)
        .lean(TICKET_LEAN);

      profileSupplement = profileUsers.map((u) => {
        const ap = u.alumniProfile || {};
        const verifiedAt =
          ap.verifiedAt instanceof Date ? ap.verifiedAt : u.updatedAt || u.createdAt || new Date();
        return {
          id: `profile:${u._id.toString()}`,
          userId: u._id.toString(),
          fullName: u.fullName || (u as { fullNameAr?: string }).fullNameAr || (u as { fullNameEn?: string }).fullNameEn || "",
          email: u.email || "",
          requestedLevel: (ap.verificationTier as string) || "basic",
          status: "approved" as const,
          attachments: [],
          aiValidationScore: undefined,
          aiNotes: undefined,
          reviewerNotes: undefined,
          reviewedAt: undefined,
          createdAt: verifiedAt,
          currentTier: ap.verificationTier || null,
          isVerifiedAlumni: true,
          verificationSource: ap.verificationSource || null,
          isProfileOnly: true,
        };
      });

      const merged =
        statusNorm === "approved" ? [...profileSupplement, ...items] : [...items, ...profileSupplement];
      merged.sort((a, b) => {
        const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(String(a.createdAt || 0)).getTime();
        const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(String(b.createdAt || 0)).getTime();
        return tb - ta;
      });
      items = merged.slice(0, limit) as typeof items;
    }

    const sampleStatus = items[0]?.status;
    alumniDebugLog("verification-requests", {
      count: items.length,
      ticketCount: rows.length,
      profileSupplement: profileSupplement.length,
      filters: { statusRaw, statusNorm, q: q ? "[set]" : "" },
      sampleStatus,
      totalTickets,
    });

    const total = page === 1 && profileSupplement.length ? totalTickets + profileSupplement.length : totalTickets;

    return NextResponse.json({
      ok: true,
      success: true,
      total,
      count: items.length,
      page,
      limit,
      pendingCount,
      items,
    });
  } catch (e) {
    console.error("[GET /api/admin/alumni/verification-requests]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
