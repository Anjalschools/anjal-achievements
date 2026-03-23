import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Notification from "@/models/Notification";
import { serializeNotification } from "@/lib/notification-serialize";

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

    return NextResponse.json({ items, limit });
  } catch (e) {
    console.error("[GET /api/notifications]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
