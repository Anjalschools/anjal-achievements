import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniInboxThread from "@/models/AlumniInboxThread";
import AlumniInboxMessage from "@/models/AlumniInboxMessage";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET() {
  try {
    await connectDB();

    const adminGate = await requireAdminUserManager();
    if (adminGate.ok) {
      const rows = await AlumniInboxThread.find({ adminArchived: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(PAGE_SIZE)
        .lean();
      const items = rows.map((row: any) => ({
        id: row._id.toString(),
        alumniId: row.alumniId?.toString?.() || "",
        subject: row.subject || "",
        lastMessagePreview: row.lastMessagePreview || "",
        lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
        unread: Number(row.adminUnreadCount || 0),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      }));
      return NextResponse.json({ ok: true, items, role: "admin" as const });
    }

    const alumniGate = await requireAlumniUser();
    if (!alumniGate.ok) return alumniGate.response;

    const uid = new mongoose.Types.ObjectId(alumniGate.userId);
    const rows = await AlumniInboxThread.find({ alumniId: uid, alumniArchived: { $ne: true } })
      .sort({ updatedAt: -1 })
      .limit(PAGE_SIZE)
      .lean();
    const items = rows.map((row: any) => ({
      id: row._id.toString(),
      subject: row.subject || "",
      lastMessagePreview: row.lastMessagePreview || "",
      lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
      unread: Number(row.alumniUnreadCount || 0),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    }));
    return NextResponse.json({ ok: true, items, role: "alumni" as const });
  } catch (error) {
    console.error("[GET /api/alumni/inbox]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const subject = sanitizeUserText(String(body.subject || "محادثة مع الإدارة"));
    const text = sanitizeUserText(String(body.body || ""));
    if (!text) return NextResponse.json({ error: "EMPTY_BODY" }, { status: 400 });

    const alumniGate = await requireAlumniUser();
    if (!alumniGate.ok) return alumniGate.response;

    const uid = new mongoose.Types.ObjectId(alumniGate.userId);
    const thread = await AlumniInboxThread.create({
      alumniId: uid,
      participantIds: [uid],
      subject,
      lastMessagePreview: text.slice(0, 280),
      lastMessageAt: new Date(),
      alumniUnreadCount: 0,
      adminUnreadCount: 1,
    });

    await AlumniInboxMessage.create({
      threadId: thread._id,
      senderId: uid,
      body: text,
    });

    return NextResponse.json({ ok: true, threadId: thread._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/alumni/inbox]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
