import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await Notification.countDocuments({
      userId: user._id,
      $or: [{ read: false }, { read: { $exists: false } }],
    });

    return NextResponse.json({ count });
  } catch (e) {
    console.error("[GET /api/notifications/unread-count]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
