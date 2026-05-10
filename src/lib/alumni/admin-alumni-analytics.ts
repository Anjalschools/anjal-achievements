import User from "@/models/User";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import AlumniEventRsvp from "@/models/AlumniEventRsvp";
import AlumniStory from "@/models/AlumniStory";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import { getAlumniIntelCached, setAlumniIntelCached } from "@/lib/alumni/alumni-intelligence-cache";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

const TTL_MS = 60_000;

const activeAlumniMatch = (): Record<string, unknown> => ({
  $and: [{ accountType: "alumni" }, alumniCommunityActiveUserClause()],
});

const cached = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const hit = getAlumniIntelCached<T>(key);
  if (hit !== null) return hit;
  const v = await fn();
  setAlumniIntelCached(key, v, TTL_MS);
  return v;
};

export type AdminAlumniOverview = {
  alumniCount: number;
  alumniVerifiedCount: number;
  mentorshipTotal: number;
  mentorshipByStatus: { status: string; count: number }[];
  topUniversities: { name: string; count: number; verifiedCount: number }[];
  topIndustries: { name: string; count: number }[];
  cohortSizes: { year: number; count: number }[];
  opportunitiesByType: { type: string; count: number }[];
  storiesPublished: number;
};

export const getAdminAlumniOverview = () =>
  cached("admin-alumni-analytics:overview", async (): Promise<AdminAlumniOverview> => {
    const [
      alumniCount,
      alumniVerifiedCount,
      mentorshipTotal,
      mentorshipByStatus,
      topUniversities,
      topIndustries,
      cohortSizes,
      opportunitiesByType,
      storiesPublished,
    ] = await Promise.all([
      User.countDocuments(activeAlumniMatch()),
      User.countDocuments({
        $and: [
          { accountType: "alumni" },
          alumniCommunityActiveUserClause(),
          { "alumniProfile.isVerifiedAlumni": true },
        ],
      }),
      AlumniMentorshipRequest.countDocuments({}),
      AlumniMentorshipRequest.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      User.aggregate<{ _id: string; count: number; verifiedCount: number }>([
        {
          $match: {
            $and: [
              { accountType: "alumni" },
              alumniCommunityActiveUserClause(),
              { "alumniProfile.universityName": { $exists: true, $nin: [null, ""] } },
            ],
          },
        },
        {
          $group: {
            _id: "$alumniProfile.universityName",
            count: { $sum: 1 },
            verifiedCount: { $sum: { $cond: [{ $eq: ["$alumniProfile.isVerifiedAlumni", true] }, 1, 0] } },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      User.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $and: [
              { accountType: "alumni" },
              alumniCommunityActiveUserClause(),
              { "alumniProfile.industry": { $exists: true, $nin: [null, ""] } },
            ],
          },
        },
        { $group: { _id: "$alumniProfile.industry", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      User.aggregate<{ _id: number; count: number }>([
        {
          $match: {
            $and: [
              { accountType: "alumni" },
              alumniCommunityActiveUserClause(),
              { "alumniProfile.graduationYear": { $exists: true, $type: "number" } },
            ],
          },
        },
        { $group: { _id: "$alumniProfile.graduationYear", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      AlumniOpportunity.aggregate<{ _id: string; count: number }>([
        { $match: { published: true } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AlumniStory.countDocuments({ published: true }),
    ]);

    return {
      alumniCount,
      alumniVerifiedCount,
      mentorshipTotal,
      mentorshipByStatus: mentorshipByStatus.map((r) => ({ status: r._id, count: r.count })),
      topUniversities: topUniversities.map((r) => ({
        name: r._id,
        count: r.count,
        verifiedCount: r.verifiedCount,
      })),
      topIndustries: topIndustries.map((r) => ({ name: r._id, count: r.count })),
      cohortSizes: cohortSizes.map((r) => ({ year: r._id, count: r.count })),
      opportunitiesByType: opportunitiesByType.map((r) => ({ type: r._id, count: r.count })),
      storiesPublished,
    };
  });

export type UniversitiesIntelRow = {
  name: string;
  alumniCount: number;
  verifiedCount: number;
  verifiedRate: number;
  avgReputation: number;
  storyMentions: number;
};

export const getAdminAlumniUniversitiesIntel = () =>
  cached("admin-alumni-analytics:universities", async (): Promise<{ items: UniversitiesIntelRow[] }> => {
    const uniAlumni = await User.aggregate<{
      _id: string;
      alumniCount: number;
      verifiedCount: number;
      avgRep: number | null;
    }>([
      {
        $match: {
          $and: [
            { accountType: "alumni" },
            alumniCommunityActiveUserClause(),
            { "alumniProfile.universityName": { $exists: true, $nin: [null, ""] } },
          ],
        },
      },
      {
        $group: {
          _id: "$alumniProfile.universityName",
          alumniCount: { $sum: 1 },
          verifiedCount: { $sum: { $cond: [{ $eq: ["$alumniProfile.isVerifiedAlumni", true] }, 1, 0] } },
          avgRep: { $avg: "$alumniProfile.reputationScore" },
        },
      },
      { $sort: { alumniCount: -1 } },
      { $limit: 25 },
    ]);

    const storyMentions = await AlumniStory.aggregate<{ _id: string; c: number }>([
      { $match: { published: true, universityName: { $exists: true, $nin: [null, ""] } } },
      { $group: { _id: "$universityName", c: { $sum: 1 } } },
    ]);
    const storyMap = new Map(storyMentions.map((s) => [s._id, s.c]));

    const items: UniversitiesIntelRow[] = uniAlumni.map((u) => {
      const ac = u.alumniCount;
      const vc = u.verifiedCount;
      return {
        name: u._id,
        alumniCount: ac,
        verifiedCount: vc,
        verifiedRate: ac > 0 ? Math.round((vc / ac) * 1000) / 10 : 0,
        avgReputation: Math.round((u.avgRep || 0) * 10) / 10,
        storyMentions: storyMap.get(u._id) || 0,
      };
    });

    return { items };
  });

export type CareersIntel = {
  topCompanies: { name: string; count: number }[];
  topIndustries: { name: string; count: number }[];
  topPositions: { title: string; count: number }[];
};

export const getAdminAlumniCareersIntel = () =>
  cached("admin-alumni-analytics:careers", async (): Promise<CareersIntel> => {
    const [topCompanies, topIndustries, topPositions] = await Promise.all([
      User.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $and: [
              { accountType: "alumni" },
              alumniCommunityActiveUserClause(),
              { "alumniProfile.currentCompany": { $exists: true, $nin: [null, ""] } },
            ],
          },
        },
        { $group: { _id: "$alumniProfile.currentCompany", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      User.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $and: [
              { accountType: "alumni" },
              alumniCommunityActiveUserClause(),
              { "alumniProfile.industry": { $exists: true, $nin: [null, ""] } },
            ],
          },
        },
        { $group: { _id: "$alumniProfile.industry", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      User.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $and: [
              { accountType: "alumni" },
              alumniCommunityActiveUserClause(),
              { "alumniProfile.currentPosition": { $exists: true, $nin: [null, ""] } },
            ],
          },
        },
        { $group: { _id: "$alumniProfile.currentPosition", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    return {
      topCompanies: topCompanies.map((r) => ({ name: r._id, count: r.count })),
      topIndustries: topIndustries.map((r) => ({ name: r._id, count: r.count })),
      topPositions: topPositions.map((r) => ({ title: r._id, count: r.count })),
    };
  });

export type EngagementIntel = {
  topByReputation: {
    userId: string;
    fullName: string;
    reputationScore: number;
    isVerifiedAlumni: boolean;
  }[];
  mentorshipRequestsLast30d: number;
  rsvpGoing: number;
  rsvpTotal: number;
  attendanceRatePercent: number;
  mentorshipHotCategories: { category: string; count: number }[];
  activeMentors: { mentorId: string; fullName: string; completed: number; accepted: number }[];
};

export const getAdminAlumniEngagementIntel = () =>
  cached("admin-alumni-analytics:engagement", async (): Promise<EngagementIntel> => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      topByReputation,
      mentorshipRequestsLast30d,
      rsvpGoing,
      rsvpTotal,
      mentorshipHotCategories,
      mentorCompleted,
    ] = await Promise.all([
      User.find(activeAlumniMatch())
        .select("fullName alumniProfile.reputationScore alumniProfile.isVerifiedAlumni")
        .sort({ "alumniProfile.reputationScore": -1 })
        .limit(12)
        .lean(),
      AlumniMentorshipRequest.countDocuments({ createdAt: { $gte: since } }),
      AlumniEventRsvp.countDocuments({ status: "going" }),
      AlumniEventRsvp.countDocuments({}),
      AlumniMentorshipRequest.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      AlumniMentorshipRequest.aggregate<{ _id: string; completed: number }>([
        { $match: { status: "completed" } },
        { $group: { _id: "$mentorId", completed: { $sum: 1 } } },
        { $sort: { completed: -1 } },
        { $limit: 12 },
      ]),
    ]);

    const mentorIds = mentorCompleted.map((m) => m._id);
    const acceptedRows =
      mentorIds.length > 0
        ? await AlumniMentorshipRequest.aggregate<{ _id: string; accepted: number }>([
            { $match: { status: "accepted", mentorId: { $in: mentorIds } } },
            { $group: { _id: "$mentorId", accepted: { $sum: 1 } } },
          ])
        : [];
    const acceptedMap = new Map(acceptedRows.map((r) => [String(r._id), r.accepted]));

    const mentors = mentorIds.length
      ? await User.find({ _id: { $in: mentorIds } })
          .select("fullName")
          .lean()
      : [];

    const nameById = new Map(mentors.map((u: any) => [String(u._id), u.fullName || ""]));

    const activeMentors = mentorCompleted.map((m) => ({
      mentorId: String(m._id),
      fullName: nameById.get(String(m._id)) || "",
      completed: m.completed,
      accepted: acceptedMap.get(String(m._id)) || 0,
    }));

    const attendanceRatePercent =
      rsvpTotal > 0 ? Math.round((rsvpGoing / rsvpTotal) * 1000) / 10 : 0;

    return {
      topByReputation: topByReputation.map((u: any) => ({
        userId: String(u._id),
        fullName: u.fullName || "",
        reputationScore: Number(u.alumniProfile?.reputationScore || 0),
        isVerifiedAlumni: u.alumniProfile?.isVerifiedAlumni === true,
      })),
      mentorshipRequestsLast30d,
      rsvpGoing,
      rsvpTotal,
      attendanceRatePercent,
      mentorshipHotCategories: mentorshipHotCategories.map((r) => ({
        category: r._id,
        count: r.count,
      })),
      activeMentors,
    };
  });
