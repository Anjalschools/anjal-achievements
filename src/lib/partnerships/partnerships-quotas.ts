import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";

export type OpportunityQuotaStats = {
  opportunityId: string;
  seats: number;
  reserveSeats: number;
  acceptedCount: number;
  candidateCount: number;
  remainingSeats: number;
  isFull: boolean;
};

const candidateStatuses = ["submitted", "under_review", "interview_requested", "institution_review"];

export const getOpportunityQuotaStats = async (
  opportunityId: string
): Promise<OpportunityQuotaStats | null> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(opportunityId)) return null;
  const opportunity = await TrainingOpportunity.findById(opportunityId)
    .select("seats reserveSeats")
    .lean();
  if (!opportunity) return null;

  const [acceptedCount, candidateCount] = await Promise.all([
    StudentTrainingApplication.countDocuments({
      opportunityId,
      status: "accepted",
      archived: { $ne: true },
    }),
    StudentTrainingApplication.countDocuments({
      opportunityId,
      status: { $in: candidateStatuses },
      archived: { $ne: true },
    }),
  ]);

  const seats = Number(opportunity.seats || 0);
  const reserveSeats = Number((opportunity as { reserveSeats?: number }).reserveSeats || 0);
  const remainingSeats = Math.max(seats - acceptedCount, 0);

  return {
    opportunityId,
    seats,
    reserveSeats,
    acceptedCount,
    candidateCount,
    remainingSeats,
    isFull: seats > 0 && acceptedCount >= seats,
  };
};

export const canAcceptIntoOpportunity = async (opportunityId: string) => {
  const stats = await getOpportunityQuotaStats(opportunityId);
  if (!stats) return { ok: false as const, reason: "opportunity_not_found" };
  if (stats.seats <= 0) return { ok: true as const, stats };
  if (stats.isFull) return { ok: false as const, reason: "seats_full", stats };
  return { ok: true as const, stats };
};

export const listOpportunitiesQuotaDashboard = async () => {
  await connectDB();
  const opportunities = await TrainingOpportunity.find({ active: { $ne: false }, archived: { $ne: true } })
    .select("title seats reserveSeats organizationId")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const rows = await Promise.all(
    opportunities.map(async (row) => {
      const stats = await getOpportunityQuotaStats(String(row._id));
      return {
        opportunityId: String(row._id),
        title: row.title,
        seats: stats?.seats ?? row.seats,
        reserveSeats: stats?.reserveSeats ?? 0,
        acceptedCount: stats?.acceptedCount ?? 0,
        candidateCount: stats?.candidateCount ?? 0,
        remainingSeats: stats?.remainingSeats ?? 0,
        isFull: stats?.isFull ?? false,
      };
    })
  );
  return rows;
};
