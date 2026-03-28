import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Notification from "@/models/Notification";
import { isNotificationDebug, notificationDebugLog } from "@/lib/notification-debug";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(_request: Request, { params }: RouteParams) {
  const id = params.id?.trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }

  try {
    await connectDB();
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doc = await Notification.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: { read: true } },
      { new: true }
    );

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (isNotificationDebug()) {
      notificationDebugLog("notification_mark_read", {
        scope: "single",
        userId: String(user._id),
        notificationId: id,
      });
    }

    return NextResponse.json({ success: true, id: doc._id.toString() });
  } catch (e) {
    console.error("[PATCH /api/notifications/[id]/read]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
