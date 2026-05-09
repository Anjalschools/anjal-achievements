import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import AlumniInboxThread from "@/models/AlumniInboxThread";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniEventRsvp from "@/models/AlumniEventRsvp";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";
import { requireAlumniUser } from "@/lib/alumni/require-alumni";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniUser();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const uid = new mongoose.Types.ObjectId(gate.userId);
    const now = new Date();

    const [profile, inboxAgg, mentorshipAsMentor, mentorshipTotal, upcomingEvents] = await Promise.all([
      User.findById(uid)
        .select("fullName profilePhoto alumniProfile accountType")
        .lean(),
      AlumniInboxThread.aggregate<{ unread: number }>([
        { $match: { alumniId: uid, alumniArchived: { $ne: true } } },
        { $group: { _id: null, unread: { $sum: "$alumniUnreadCount" } } },
      ]),
      AlumniMentorshipRequest.countDocuments({ mentorId: uid, status: "pending" }),
      AlumniMentorshipRequest.countDocuments({
        $or: [{ requesterId: uid }, { mentorId: uid }],
        status: { $in: ["pending", "accepted", "completed"] },
      }),
      AlumniEventRsvp.aggregate<{ c: number }>([
        {
          $match: {
            userId: uid,
            status: "going",
          },
        },
        {
          $lookup: {
            from: AlumniReunionEvent.collection.name,
            localField: "eventId",
            foreignField: "_id",
            as: "ev",
          },
        },
        { $unwind: "$ev" },
        { $match: { "ev.published": true, "ev.startsAt": { $gte: now } } },
        { $count: "c" },
      ]),
    ]);

    const unreadMessages = inboxAgg[0]?.unread ?? 0;
    const upcoming = upcomingEvents[0]?.c ?? 0;

    const ap = (profile as any)?.alumniProfile || {};

    return NextResponse.json({
      ok: true,
      profile: {
        fullName: (profile as any)?.fullName || "",
        graduationYear: ap.graduationYear ?? null,
        universityName: ap.universityName ?? "",
        currentCompany: ap.currentCompany ?? "",
        profilePhoto: (profile as any)?.profilePhoto ?? null,
      },
      stats: {
        contributionsCount: mentorshipTotal,
        mentorshipPendingIncoming: mentorshipAsMentor,
        inboxUnread: unreadMessages,
        upcomingEvents: upcoming,
      },
    });
  } catch (error) {
    console.error("[GET /api/alumni/dashboard-summary]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
