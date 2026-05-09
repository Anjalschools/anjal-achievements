import mongoose from "mongoose";
import User from "@/models/User";
import type { AlumniCampaignAudienceFilter } from "@/models/AlumniCampaign";

export type ResolvedAudience = {
  userIds: mongoose.Types.ObjectId[];
  totalMatched: number;
};

/**
 * Resolves audience filters to User ids (alumni only). Pagination-ready via limit.
 */
export const resolveAlumniAudience = async (
  filter: AlumniCampaignAudienceFilter,
  limit = 500
): Promise<ResolvedAudience> => {
  const q: Record<string, unknown> = {
    accountType: "alumni",
    /** Respect alumni search visibility for outbound campaigns (additive). */
    $nor: [{ "alumniProfile.privacySettings.searchable": false }],
  };

  if (typeof filter.cohortYear === "number") {
    q["alumniProfile.graduationYear"] = filter.cohortYear;
  }
  if (Array.isArray(filter.cohortYears) && filter.cohortYears.length) {
    q["alumniProfile.graduationYear"] = { $in: filter.cohortYears };
  }
  if (typeof filter.university === "string" && filter.university.trim()) {
    q["alumniProfile.universityName"] = new RegExp(filter.university.trim(), "i");
  }
  if (typeof filter.country === "string" && filter.country.trim()) {
    q["alumniProfile.country"] = new RegExp(filter.country.trim(), "i");
  }
  if (typeof filter.industry === "string" && filter.industry.trim()) {
    q["alumniProfile.industry"] = new RegExp(filter.industry.trim(), "i");
  }
  if (filter.verifiedOnly === true) {
    q["alumniProfile.isVerifiedAlumni"] = true;
  }
  if (filter.mentorsOnly === true) {
    q["alumniProfile.alumniServices.mentoring"] = true;
  }
  if (typeof filter.inactiveDays === "number" && filter.inactiveDays > 0) {
    const cutoff = new Date(Date.now() - filter.inactiveDays * 86_400_000);
    q.$or = [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }, { lastLoginAt: { $lt: cutoff } }];
  }
  if (filter.activityTier === "inactive") {
    const cutoff = new Date(Date.now() - 90 * 86_400_000);
    q.$or = [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }, { lastLoginAt: { $lt: cutoff } }];
  }

  const totalMatched = await User.countDocuments(q);
  const rows = await User.find(q).select("_id").limit(limit).lean();
  const userIds = rows.map((r) => r._id as mongoose.Types.ObjectId);

  return { userIds, totalMatched };
};
