import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));
    const skip = (page - 1) * limit;
    const actionType = String(searchParams.get("actionType") || "").trim();
    const entityType = String(searchParams.get("entityType") || "").trim();
    const actorEmail = String(searchParams.get("actorEmail") || "").trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const q: Record<string, unknown> = {};
    if (actionType) q.actionType = actionType;
    if (entityType) q.entityType = entityType;
    if (actorEmail) q.actorEmail = new RegExp(actorEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (from || to) {
      q.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    }

    const total = await AuditLog.countDocuments(q);
    const items = await AuditLog.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      limit,
    });
  } catch (e) {
    console.error("[GET /api/admin/audit-logs]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
