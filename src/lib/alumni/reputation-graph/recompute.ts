import mongoose from "mongoose";
import User from "@/models/User";
import AlumniReputation from "@/models/AlumniReputation";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniEventRsvp from "@/models/AlumniEventRsvp";
import AlumniStory from "@/models/AlumniStory";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import type { AlumniReputationTierName } from "@/models/AlumniReputation";
import { publicApprovedOpportunityClause } from "@/lib/alumni/normalize-opportunity-status";

export type AlumniReputationSnapshot = {
  userId: string;
  reputationScore: number;
  mentorshipScore: number;
  communityContributionScore: number;
  eventParticipationScore: number;
  careerImpactScore: number;
  verificationScore: number;
  networkStrengthScore: number;
  contentContributionScore: number;
  lastCalculatedAt: string;
  badges: string[];
  tiers: string[];
  currentTier: AlumniReputationTierName;
};

const BADGE = {
  verified: "Verified Alumni",
  mentor: "Mentor",
  speaker: "Speaker",
  leader: "Leader",
  globalAlumni: "Global Alumni",
  topContributor: "Top Contributor",
  careerGuide: "Career Guide",
  communityAmbassador: "Community Ambassador",
} as const;

const tierFromScore = (s: number): AlumniReputationTierName => {
  if (s >= 800) return "Legend";
  if (s >= 650) return "Ambassador";
  if (s >= 500) return "Elite";
  if (s >= 300) return "Gold";
  if (s >= 150) return "Silver";
  return "Bronze";
};

const tierTrail = (current: AlumniReputationTierName): string[] => {
  const order: AlumniReputationTierName[] = ["Bronze", "Silver", "Gold", "Elite", "Ambassador", "Legend"];
  const i = order.indexOf(current);
  return order.slice(0, Math.max(1, i + 1));
};

const daysSince = (d?: Date | null): number => {
  if (!d) return 9999;
  return (Date.now() - d.getTime()) / 86_400_000;
};

/**
 * Full reputation graph recompute: persists {@link AlumniReputation} and legacy `alumniProfile.reputationScore`.
 */
export const recomputeAlumniReputationGraph = async (
  userId: mongoose.Types.ObjectId
): Promise<AlumniReputationSnapshot> => {
  const row = await User.findById(userId).select("alumniProfile accountType lastLoginAt updatedAt").lean();
  const p: Record<string, unknown> = (row as any)?.alumniProfile || {};
  const accountType = (row as any)?.accountType;

  let verificationScore = 0;
  if (p.isVerifiedAlumni === true) verificationScore += 50;
  if (p.isFeaturedAlumni === true) verificationScore += 15;
  if (p.isAmbassadorAlumni === true) verificationScore += 25;
  if (p.isDistinguishedAlumni === true) verificationScore += 30;
  const vSrc = p.verificationSource;
  if (typeof vSrc === "string" && vSrc.length) verificationScore += 5;
  verificationScore = Math.min(120, verificationScore);

  const svc = (p.alumniServices || {}) as Record<string, boolean>;
  let communityContributionScore = 0;
  for (const v of Object.values(svc)) {
    if (v === true) communityContributionScore += 8;
  }
  if (svc.mentoring === true) communityContributionScore += 12;
  if (svc.workshops === true) communityContributionScore += 6;
  communityContributionScore = Math.min(120, communityContributionScore);

  const [mentorCompleted, mentorAccepted, mentorPending, asRequesterDone] = await Promise.all([
    AlumniMentorshipRequest.countDocuments({ mentorId: userId, status: "completed" }),
    AlumniMentorshipRequest.countDocuments({ mentorId: userId, status: "accepted" }),
    AlumniMentorshipRequest.countDocuments({ mentorId: userId, status: "pending" }),
    AlumniMentorshipRequest.countDocuments({ requesterId: userId, status: { $in: ["completed", "accepted"] } }),
  ]);
  let mentorshipScore = Math.min(220, mentorCompleted * 14 + mentorAccepted * 10 + mentorPending * 3 + asRequesterDone * 6);

  const [eventsGoing, eventsMaybe] = await Promise.all([
    AlumniEventRsvp.countDocuments({ userId, status: "going" }),
    AlumniEventRsvp.countDocuments({ userId, status: "maybe" }),
  ]);
  const eventParticipationScore = Math.min(100, eventsGoing * 12 + eventsMaybe * 4);

  const [storiesN, oppsN] = await Promise.all([
    AlumniStory.countDocuments({ relatedUserId: userId, published: true }),
    AlumniOpportunity.countDocuments({
      createdByUserId: userId,
      ...publicApprovedOpportunityClause(),
    }),
  ]);
  const contentContributionScore = Math.min(150, storiesN * 35 + oppsN * 25);

  let careerImpactScore = 0;
  const fields = [p.universityName, p.major, p.degree, p.currentCompany, p.currentPosition, p.industry, p.country, p.city, p.bio, p.linkedinUrl];
  for (const f of fields) {
    if (typeof f === "string" && f.trim().length > 2) careerImpactScore += 10;
  }
  if (typeof p.graduationYear === "number") careerImpactScore += 8;
  careerImpactScore = Math.min(130, careerImpactScore);

  let networkStrengthScore = 0;
  const lastLogin = (row as any)?.lastLoginAt as Date | undefined;
  const updatedAt = (row as any)?.updatedAt as Date | undefined;
  if (daysSince(lastLogin) < 14) networkStrengthScore += 40;
  else if (daysSince(lastLogin) < 45) networkStrengthScore += 25;
  else if (daysSince(lastLogin) < 120) networkStrengthScore += 12;
  if (daysSince(updatedAt) < 30) networkStrengthScore += 25;
  networkStrengthScore = Math.min(100, networkStrengthScore);

  if (accountType === "alumni") {
    networkStrengthScore += 8;
    networkStrengthScore = Math.min(100, networkStrengthScore);
  }

  const reputationScore = Math.min(
    1000,
    Math.round(
      verificationScore +
        mentorshipScore +
        communityContributionScore +
        eventParticipationScore +
        contentContributionScore +
        careerImpactScore +
        networkStrengthScore
    )
  );

  const currentTier = tierFromScore(reputationScore);
  const tiers = tierTrail(currentTier);

  const badges: string[] = [];
  if (p.isVerifiedAlumni === true) badges.push(BADGE.verified);
  if (svc.mentoring === true) badges.push(BADGE.mentor);
  if (svc.workshops === true || svc.judging === true) badges.push(BADGE.speaker);
  if (p.isFeaturedAlumni === true || p.isDistinguishedAlumni === true) badges.push(BADGE.leader);
  if (p.country && p.studyCountry && String(p.country) !== String(p.studyCountry)) badges.push(BADGE.globalAlumni);
  if (mentorCompleted >= 5 || storiesN >= 2) badges.push(BADGE.topContributor);
  if (svc.jobs === true || svc.internships === true) badges.push(BADGE.careerGuide);
  if (p.isAmbassadorAlumni === true || mentorCompleted >= 8) badges.push(BADGE.communityAmbassador);

  const now = new Date();
  await AlumniReputation.findOneAndUpdate(
    { userId },
    {
      $set: {
        reputationScore,
        mentorshipScore,
        communityContributionScore,
        eventParticipationScore,
        careerImpactScore,
        verificationScore,
        networkStrengthScore,
        contentContributionScore,
        lastCalculatedAt: now,
        badges: [...new Set(badges)],
        tiers,
      },
    },
    { upsert: true, new: true }
  );

  const vt = p.verificationTier as string | undefined;
  const tierTrust: Record<string, number> = {
    basic: 6,
    academic: 12,
    career: 14,
    institution: 18,
    global: 22,
  };
  const trustScore = Math.min(
    100,
    Math.round(
      reputationScore * 0.07 +
        (p.isVerifiedAlumni === true ? 10 : 0) +
        (vt && tierTrust[vt] !== undefined ? tierTrust[vt] : 0) +
        Math.min(18, mentorCompleted * 2)
    )
  );

  await User.updateOne(
    { _id: userId },
    { $set: { "alumniProfile.reputationScore": reputationScore, "alumniProfile.trustScore": trustScore } }
  );

  return {
    userId: userId.toString(),
    reputationScore,
    mentorshipScore,
    communityContributionScore,
    eventParticipationScore,
    careerImpactScore,
    verificationScore,
    networkStrengthScore,
    contentContributionScore,
    lastCalculatedAt: now.toISOString(),
    badges: [...new Set(badges)],
    tiers,
    currentTier,
  };
};

export const batchRecomputeAlumniReputation = async (limit = 120): Promise<{ updated: number }> => {
  const rows = await User.find({ accountType: "alumni" })
    .select("_id")
    .sort({ updatedAt: -1 })
    .limit(Math.min(500, Math.max(1, limit)))
    .lean();
  let updated = 0;
  for (const r of rows) {
    await recomputeAlumniReputationGraph(r._id as mongoose.Types.ObjectId);
    updated += 1;
  }
  return { updated };
};
