import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import {
  enrichAuditLogForUi,
  isAuditCategory,
  actionTypesForAuditCategory,
  actionTypesForOperationFilter,
  normalizePlatformKey,
  type AuditOperationFilter,
} from "@/lib/audit-log-display";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const endOfDayIso = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "30", 10) || 30));
    const skip = (page - 1) * limit;

    const actionTypeSingle = String(searchParams.get("actionType") || "").trim();
    const type = String(searchParams.get("type") || "").trim() as AuditOperationFilter | "";
    const category = String(searchParams.get("category") || "").trim();
    const entityType = String(searchParams.get("entityType") || "").trim();
    const actorEmail = String(searchParams.get("actorEmail") || "").trim();
    const actorId = String(searchParams.get("actorId") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const platform = String(searchParams.get("platform") || "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = String(searchParams.get("search") || searchParams.get("q") || "").trim();
    const lang = searchParams.get("lang");
    const isAr = lang !== "en";

    const andParts: Record<string, unknown>[] = [];

    if (actionTypeSingle) {
      andParts.push({ actionType: actionTypeSingle });
    } else if (type && type !== "all") {
      const types = actionTypesForOperationFilter(type as AuditOperationFilter);
      if (types?.length) andParts.push({ actionType: { $in: types } });
    } else if (category && isAuditCategory(category)) {
      const types = actionTypesForAuditCategory(category);
      if (types.length) andParts.push({ actionType: { $in: types } });
    }

    if (entityType) andParts.push({ entityType });
    if (actorEmail) {
      andParts.push({
        actorEmail: new RegExp(actorEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      });
    }
    if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
      andParts.push({ actorId: new mongoose.Types.ObjectId(actorId) });
    }

    if (status === "blocked") {
      andParts.push({ actionType: "news_publish_blocked" });
    } else if (status === "success") {
      andParts.push({ outcome: "success" });
    } else if (status === "failure") {
      andParts.push({ outcome: "failure" });
      andParts.push({ actionType: { $ne: "news_publish_blocked" } });
    } else if (status === "partial") {
      andParts.push({ outcome: "partial" });
    }

    if (platform) {
      const pl = normalizePlatformKey(platform);
      andParts.push({
        $or: [{ platform: pl }, { "metadata.platform": pl }, { "metadata.targets": pl }],
      });
    }

    if (from || to) {
      andParts.push({
        createdAt: {
          ...(from ? { $gte: new Date(from) } : {}),
          ...(to ? { $lte: new Date(endOfDayIso(to)) } : {}),
        },
      });
    }

    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(esc, "i");
      andParts.push({
        $or: [
          { descriptionAr: rx },
          { entityTitle: rx },
          { actorEmail: rx },
          { actionType: rx },
          { actorName: rx },
        ],
      });
    }

    const q: Record<string, unknown> =
      andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0] : { $and: andParts };

    const total = await AuditLog.countDocuments(q);
    const raw = await AuditLog.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = raw.map((row) => enrichAuditLogForUi(row as unknown as Record<string, unknown>, isAr));

    return NextResponse.json({
      success: true,
      ok: true,
      data: items,
      items,
      total,
      page,
      limit,
      message: isAr ? "تم التحميل" : "Loaded",
      messageEn: "Loaded",
    });
  } catch (e) {
    console.error("[GET /api/admin/audit-logs]", e);
    return NextResponse.json(
      { success: false, error: "Internal server error", message: "خطأ", messageEn: "Server error" },
      { status: 500 }
    );
  }
}
