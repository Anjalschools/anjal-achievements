import mongoose from "mongoose";
import { recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";

/**
 * Deterministic reputation 0–1000 for alumni (cached on user.alumniProfile.reputationScore).
 * Persists full breakdown on {@link AlumniReputation}.
 */
export const computeAlumniReputationScore = async (userId: mongoose.Types.ObjectId): Promise<number> => {
  const snap = await recomputeAlumniReputationGraph(userId);
  return snap.reputationScore;
};

export { recomputeAlumniReputationGraph, batchRecomputeAlumniReputation } from "@/lib/alumni/reputation-graph/recompute";
