import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Notification from "@/models/Notification";
import { serializeNotification } from "@/lib/notification-serialize";
import { getNotificationCategory } from "@/lib/notification-category";
import { isNotificationDebug, notificationDebugLog } from "@/lib/notification-debug";

export const dynamic = "force-dynamic";

const LIMIT = 80;

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Math.min(
      LIMIT,
      Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "40", 10) || 40)
    );

    const rows = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const items = rows.map((row) => serializeNotification(row as unknown as Record<string, unknown>));

    if (isNotificationDebug()) {
      const buckets: Record<string, number> = { reviews: 0, certificates: 0, system: 0, general: 0 };
      for (const row of rows) {
        const plain = row as { type?: string };
        const cat = getNotificationCategory(String(plain.type || ""));
        buckets[cat] = (buckets[cat] ?? 0) + 1;
      }
      notificationDebugLog("notifications_query_result", {
        userId: String(user._id),
        total: rows.length,
        notification_category_mapping: buckets,
      });
    }

    return NextResponse.json({ items, limit });
  } catch (e) {
    console.error("[GET /api/notifications]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
