import User from "@/models/User";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";
import { enqueueAutomationJob } from "./lifecycle-engine";

const MS_DAY = 86_400_000;

/** Mentorship: pending requests older than N hours → reminder jobs for mentor inbox awareness */
export const enqueueMentorshipStaleReminders = async (olderThanHours = 72): Promise<number> => {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
  const rows = await AlumniMentorshipRequest.find({
    status: "pending",
    updatedAt: { $lte: cutoff },
  })
    .select("mentorId requesterId _id")
    .limit(80)
    .lean();

  let n = 0;
  for (const row of rows) {
    const mentorId = String(row.mentorId);
    const r = await enqueueAutomationJob({
      type: "mentorship.reminder",
      payload: {
        userId: mentorId,
        mentorshipRequestId: row._id.toString(),
        requesterId: row.requesterId.toString(),
      },
      correlationId: `mentorship-rem-${row._id.toString()}`,
    });
    if (r.created) n += 1;
  }
  return n;
};

/** Events starting within next `withinDays` → invitation jobs (scoped by cohort when present; capped per event). */
export const enqueueUpcomingEventReminders = async (withinDays = 14): Promise<number> => {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * MS_DAY);
  const events = await AlumniReunionEvent.find({
    published: true,
    startsAt: { $gte: now, $lte: until },
  })
    .select("_id title slug startsAt cohortYear")
    .limit(20)
    .lean();

  let n = 0;
  for (const ev of events) {
    const filter: Record<string, unknown> = { accountType: "alumni" };
    if (typeof ev.cohortYear === "number") {
      filter["alumniProfile.graduationYear"] = ev.cohortYear;
    }
    const alumni = await User.find(filter).select("_id").limit(120).lean();

    for (const u of alumni) {
      const uid = u._id.toString();
      const r = await enqueueAutomationJob({
        type: "event.invitation",
        payload: {
          userId: uid,
          eventId: ev._id.toString(),
          title: ev.title,
          slug: ev.slug,
          startsAt: ev.startsAt?.toISOString(),
        },
        correlationId: `event-inv-${ev._id}-${uid}`,
        scheduledFor: now,
      });
      if (r.created) n += 1;
    }
  }
  return n;
};
