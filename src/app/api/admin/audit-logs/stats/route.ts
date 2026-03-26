import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { actionTypesForAuditCategory } from "@/lib/audit-log-display";

export const dynamic = "force-dynamic";

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
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateQ: Record<string, unknown> = {};
    if (from || to) {
      dateQ.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(endOfDayIso(to)) } : {}),
      };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const newsTypes = actionTypesForAuditCategory("news");
    const pubTypes = actionTypesForAuditCategory("publishing");
    const aiTypes = actionTypesForAuditCategory("ai");

    const withRange = (extra: Record<string, unknown>) =>
      Object.keys(dateQ).length ? { $and: [dateQ, extra] } : extra;

    const [total, todayCount, newsCount, publishingCount, failedCount, aiCount] = await Promise.all([
      AuditLog.countDocuments(dateQ),
      AuditLog.countDocuments(withRange({ createdAt: { $gte: todayStart } })),
      AuditLog.countDocuments(withRange({ actionType: { $in: newsTypes } })),
      AuditLog.countDocuments(withRange({ actionType: { $in: pubTypes } })),
      AuditLog.countDocuments(withRange({ outcome: "failure" })),
      AuditLog.countDocuments(withRange({ actionType: { $in: aiTypes } })),
    ]);

    return NextResponse.json({
      success: true,
      ok: true,
      stats: {
        total,
        todayCount,
        newsCount,
        publishingCount,
        failedCount,
        aiCount,
      },
      message: "تم التحميل",
      messageEn: "Loaded",
    });
  } catch (e) {
    console.error("[GET /api/admin/audit-logs/stats]", e);
    return NextResponse.json(
      { success: false, error: "Internal server error", messageEn: "Server error" },
      { status: 500 }
    );
  }
}
