import mongoose from "mongoose";
import User from "@/models/User";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniEventRsvp from "@/models/AlumniEventRsvp";
import AlumniInboxThread from "@/models/AlumniInboxThread";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import AlumniAutomationJob from "@/models/AlumniAutomationJob";
import AlumniRelationshipScore, {
  type AlumniCrmSegment,
} from "@/models/AlumniRelationshipScore";
import { weightSignals, type EngagementSignals } from "@/lib/alumni/automation/engagement-engine";
import { getAlumniIntelCached, setAlumniIntelCached } from "@/lib/alumni/alumni-intelligence-cache";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

const SEG_TTL_MS = 45_000;

const profileCompleteness = (ap: Record<string, unknown>): number => {
  let pts = 0;
  const fields = ["universityName", "major", "industry", "bio", "currentCompany", "linkedinUrl"];
  for (const f of fields) {
    const v = ap[f];
    if (typeof v === "string" && v.trim().length > 2) pts += 15;
  }
  return Math.min(100, pts);
};

const segmentFromScore = (
  score: number,
  signals: EngagementSignals,
  ap: Record<string, unknown>
): AlumniCrmSegment => {
  const rep = typeof ap.reputationScore === "number" ? ap.reputationScore : Number(ap.reputationScore ?? 0);
  const elite =
    ap.isDistinguishedAlumni === true ||
    ap.isFeaturedAlumni === true ||
    score >= 520 ||
    rep >= 400;
  if (elite) return "Elite Alumni";

  const dormant = score < 120 && signals.eventsGoing === 0 && signals.mentorshipCompleted === 0;
  if (dormant) return "Dormant Alumni";

  const mentorPotential =
    ap.isVerifiedAlumni === true &&
    signals.mentorshipCompleted >= 2 &&
    (ap.alumniServices as { mentoring?: boolean } | undefined)?.mentoring !== true;

  if (mentorPotential) return "Potential Mentor";

  const sponsorSignals =
    typeof ap.currentCompany === "string" &&
    ap.currentCompany.length > 2 &&
    (signals.opportunitiesAuthored > 0 || score >= 280);
  if (sponsorSignals) return "Potential Sponsor";

  if (score >= 380 || signals.mentorshipCompleted >= 3) return "Highly Engaged";

  if (score >= 220) return "Strategic Alumni";

  return "Dormant Alumni";
};

export const computeAlumniRelationshipScore = async (
  userId: mongoose.Types.ObjectId
): Promise<{ score: number; segment: AlumniCrmSegment; breakdown: Record<string, number> }> => {
  const user = await User.findById(userId).select("alumniProfile lastLoginAt").lean();
  const ap = ((user as any)?.alumniProfile || {}) as Record<string, unknown>;

  const [mentorshipCompleted, mentorshipAccepted, eventsGoing, inboxThreads, opportunitiesAuthored, campaignOpens] =
    await Promise.all([
      AlumniMentorshipRequest.countDocuments({ mentorId: userId, status: "completed" }),
      AlumniMentorshipRequest.countDocuments({ mentorId: userId, status: "accepted" }),
      AlumniEventRsvp.countDocuments({ userId, status: "going" }),
      AlumniInboxThread.countDocuments({ participantIds: userId }),
      AlumniOpportunity.countDocuments({ createdByUserId: userId, published: true }),
      AlumniCampaignRecipient.countDocuments({ userId, status: { $in: ["opened", "clicked"] } }),
    ]);

  const pc = profileCompleteness(ap);
  const signals: EngagementSignals = {
    mentorshipCompleted,
    mentorshipAccepted,
    eventsGoing,
    inboxThreads: Math.min(inboxThreads, 20),
    opportunitiesAuthored,
    campaignOpens,
    profileCompleteness: pc,
  };

  const score = weightSignals(signals);
  const segment = segmentFromScore(score, signals, ap);

  const breakdown = {
    mentorshipCompleted,
    mentorshipAccepted,
    eventsGoing,
    inboxThreads,
    opportunitiesAuthored,
    campaignOpens,
    profileCompleteness: pc,
  };

  return { score, segment, breakdown };
};

export const upsertRelationshipScore = async (userId: mongoose.Types.ObjectId): Promise<void> => {
  const { score, segment, breakdown } = await computeAlumniRelationshipScore(userId);
  await AlumniRelationshipScore.findOneAndUpdate(
    { userId },
    {
      $set: {
        score,
        segment,
        breakdown,
        computedAt: new Date(),
      },
    },
    { upsert: true }
  );
};

export type CrmOverview = {
  alumniTotal: number;
  segments: Record<string, number>;
  avgScore: number;
  jobsPending: number;
};

/** Cached lightweight CRM overview for admin dashboard */
export const getCrmOverviewCached = async (): Promise<CrmOverview> => {
  const key = "crm:overview:v1";
  const hit = getAlumniIntelCached<CrmOverview>(key);
  if (hit) return hit;

  const alumniTotal = await User.countDocuments({
    accountType: "alumni",
    ...alumniCommunityActiveUserClause(),
  });
  const segRows = await AlumniRelationshipScore.aggregate<{ _id: string; c: number }>([
    { $group: { _id: "$segment", c: { $sum: 1 } } },
  ]);
  const segments: Record<string, number> = {};
  for (const r of segRows) segments[r._id] = r.c;

  const avg = await AlumniRelationshipScore.aggregate<{ v: number | null }>([
    { $group: { _id: null, v: { $avg: "$score" } } },
  ]);

  const jobsPending = await AlumniAutomationJob.countDocuments({ status: "pending" });

  const overview: CrmOverview = {
    alumniTotal,
    segments,
    avgScore: Math.round((avg[0]?.v || 0) * 10) / 10,
    jobsPending,
  };

  setAlumniIntelCached(key, overview, SEG_TTL_MS);
  return overview;
};
