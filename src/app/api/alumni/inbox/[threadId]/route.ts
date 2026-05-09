import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniInboxThread from "@/models/AlumniInboxThread";
import AlumniInboxMessage from "@/models/AlumniInboxMessage";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { isPlatformAdmin } from "@/lib/alumni/alumni-staff";
import { getCurrentDbUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ threadId: string }> };

const canAccessThread = async (
  threadId: mongoose.Types.ObjectId,
  userId: string,
  asAdmin: boolean
): Promise<boolean> => {
  const thread = await AlumniInboxThread.findById(threadId).select("alumniId").lean();
  if (!thread) return false;
  if (asAdmin) return true;
  return String((thread as any).alumniId) === userId;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { threadId } = await params;
    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const tid = new mongoose.Types.ObjectId(threadId);

    const adminGate = await requireAdminUserManager();
    if (adminGate.ok) {
      const exists = await AlumniInboxThread.exists({ _id: tid });
      if (!exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    } else {
      const alumniGate = await requireAlumniUser();
      if (!alumniGate.ok) return alumniGate.response;
      const ok = await canAccessThread(tid, alumniGate.userId, false);
      if (!ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const messages = await AlumniInboxMessage.find({
      threadId: tid,
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .select("senderId body createdAt")
      .lean();

    return NextResponse.json({
      ok: true,
      messages: messages.map((m: any) => ({
        id: m._id.toString(),
        senderId: m.senderId?.toString?.() || "",
        body: m.body || "",
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/alumni/inbox/[threadId]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { threadId } = await params;
    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const tid = new mongoose.Types.ObjectId(threadId);
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const text = sanitizeUserText(String(body.body || ""));
    if (!text) return NextResponse.json({ error: "EMPTY_BODY" }, { status: 400 });

    const adminGate = await requireAdminUserManager();
    if (adminGate.ok) {
      const senderId = new mongoose.Types.ObjectId(String(adminGate.user._id));
      await AlumniInboxMessage.create({ threadId: tid, senderId, body: text });
      await AlumniInboxThread.updateOne(
        { _id: tid },
        {
          $set: {
            lastMessagePreview: text.slice(0, 280),
            lastMessageAt: new Date(),
          },
          $inc: { alumniUnreadCount: 1 },
          $addToSet: { participantIds: senderId },
        }
      );
      return NextResponse.json({ ok: true });
    }

    const alumniGate = await requireAlumniUser();
    if (!alumniGate.ok) return alumniGate.response;
    const okThread = await canAccessThread(tid, alumniGate.userId, false);
    if (!okThread) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const senderId = new mongoose.Types.ObjectId(alumniGate.userId);
    await AlumniInboxMessage.create({ threadId: tid, senderId, body: text });
    await AlumniInboxThread.updateOne(
      { _id: tid },
      {
        $set: {
          lastMessagePreview: text.slice(0, 280),
          lastMessageAt: new Date(),
        },
        $inc: { adminUnreadCount: 1 },
        $addToSet: { participantIds: senderId },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/alumni/inbox/[threadId]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { threadId } = await params;
    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    const tid = new mongoose.Types.ObjectId(threadId);
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const action = String(body.action || "");

    const adminGate = await requireAdminUserManager();
    const alumniGate = await requireAlumniUser();

    if (action === "markRead") {
      if (adminGate.ok) {
        await AlumniInboxThread.updateOne({ _id: tid }, { $set: { adminUnreadCount: 0 } });
        return NextResponse.json({ ok: true });
      }
      if (alumniGate.ok) {
        const ok = await canAccessThread(tid, alumniGate.userId, false);
        if (!ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        await AlumniInboxThread.updateOne({ _id: tid }, { $set: { alumniUnreadCount: 0 } });
        return NextResponse.json({ ok: true });
      }
      return alumniGate.response;
    }

    if (action === "archive") {
      if (adminGate.ok) {
        await AlumniInboxThread.updateOne({ _id: tid }, { $set: { adminArchived: true } });
        return NextResponse.json({ ok: true });
      }
      if (alumniGate.ok) {
        const ok = await canAccessThread(tid, alumniGate.userId, false);
        if (!ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        await AlumniInboxThread.updateOne({ _id: tid }, { $set: { alumniArchived: true } });
        return NextResponse.json({ ok: true });
      }
      return alumniGate.response;
    }

    if (action === "softDeleteMessage") {
      const messageId = String(body.messageId || "");
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
      }
      const mid = new mongoose.Types.ObjectId(messageId);
      const msg = await AlumniInboxMessage.findById(mid).select("threadId senderId").lean();
      if (!msg || String((msg as any).threadId) !== String(tid)) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      const user = await getCurrentDbUser();
      if (!user?._id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      const isOwner = String((msg as any).senderId) === String(user._id);
      const isAdmin = isPlatformAdmin(user as any);
      if (!isOwner && !isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      await AlumniInboxMessage.updateOne({ _id: mid }, { $set: { deletedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    console.error("[PATCH /api/alumni/inbox/[threadId]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
