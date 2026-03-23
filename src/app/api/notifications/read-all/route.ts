import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    await connectDB();
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await Notification.updateMany({ userId: user._id }, { $set: { read: true } });

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (e) {
    console.error("[PATCH /api/notifications/read-all]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
