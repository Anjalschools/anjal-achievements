import mongoose from "mongoose";
import User from "@/models/User";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import { buildViewerMatchProfile } from "@/lib/alumni/matching/viewer-profile";
import { scoreMentor, type MentorCandidate } from "@/lib/alumni/matching/mentor-matching";
import { symmetricAlumniAffinity } from "./similarity";
import type { CareerGraphEdge, CareerGraphNode, ScoredAlumniPeer } from "./types";

export const leanUserToMentorCandidate = (row: unknown): MentorCandidate => {
  const r = row as Record<string, unknown>;
  const p = (r.alumniProfile as Record<string, unknown> | undefined) || {};
  return {
    id: (r._id as mongoose.Types.ObjectId).toString(),
    fullName: String(r.fullName || ""),
    universityName: (p.universityName as string) ?? null,
    major: (p.major as string) ?? null,
    industry: (p.industry as string) ?? null,
    country: (p.country as string) ?? null,
    studyCountry: (p.studyCountry as string) ?? null,
    graduationYear: typeof p.graduationYear === "number" ? p.graduationYear : null,
    bio: (p.bio as string) ?? null,
    updatedAt: r.updatedAt ? new Date(String(r.updatedAt)) : null,
    lastLoginAt: r.lastLoginAt ? new Date(String(r.lastLoginAt)) : null,
    isVerifiedAlumni: p.isVerifiedAlumni === true,
    reputationScore: typeof p.reputationScore === "number" ? p.reputationScore : null,
  };
};

const loadMentorshipNeighborIds = async (selfId: string): Promise<Set<string>> => {
  const set = new Set<string>();
  if (!mongoose.isValidObjectId(selfId)) return set;
  const oid = new mongoose.Types.ObjectId(selfId);
  const rows = await AlumniMentorshipRequest.find({
    status: { $in: ["accepted", "completed"] },
    $or: [{ requesterId: oid }, { mentorId: oid }],
  })
    .select("requesterId mentorId")
    .limit(200)
    .lean();

  for (const r of rows) {
    const a = String(r.requesterId);
    const b = String(r.mentorId);
    if (a === selfId) set.add(b);
    else if (b === selfId) set.add(a);
  }
  return set;
};

export type LoadPeersResult = {
  self: MentorCandidate;
  viewer: ReturnType<typeof buildViewerMatchProfile>;
  peers: ScoredAlumniPeer[];
  mentorshipNeighbors: Set<string>;
};

export const loadCareerGraphPeers = async (input: {
  selfUserId: string;
  selfLean: unknown;
  focusSearchParams?: URLSearchParams;
  poolLimit?: number;
  topK?: number;
}): Promise<LoadPeersResult> => {
  const poolLimit = input.poolLimit ?? 160;
  const topK = input.topK ?? 36;

  const selfRow = {
    ...((input.selfLean as object) || {}),
    _id: new mongoose.Types.ObjectId(input.selfUserId),
  };
  const self = leanUserToMentorCandidate(selfRow);

  const viewer = buildViewerMatchProfile(input.selfLean as any, input.focusSearchParams);

  const mentorshipNeighbors = await loadMentorshipNeighborIds(input.selfUserId);

  const rows = await User.find({
    accountType: "alumni",
    _id: { $ne: new mongoose.Types.ObjectId(input.selfUserId) },
  })
    .select("fullName alumniProfile updatedAt lastLoginAt")
    .sort({ updatedAt: -1 })
    .limit(poolLimit)
    .lean();

  const peers: ScoredAlumniPeer[] = [];

  for (const row of rows) {
    const c = leanUserToMentorCandidate(row);
    const directional = scoreMentor(viewer, c, input.selfUserId);
    if (directional.score <= 0 && !mentorshipNeighbors.has(c.id)) continue;

    const sym = symmetricAlumniAffinity(self, c);
    let w = Math.max(0, directional.score);
    w += Math.min(28, Math.floor(sym.weight / 3));
    const reasons = [...new Set([...directional.reasons, ...sym.reasons])];
    if (mentorshipNeighbors.has(c.id)) {
      w += 22;
      reasons.push("mentorship_link");
    }

    peers.push({ peer: c, weight: w, reasons });
  }

  peers.sort((a, b) => b.weight - a.weight);
  const trimmed = peers.slice(0, topK);

  return { self, viewer, peers: trimmed, mentorshipNeighbors };
};

export const peersToGraph = (
  self: MentorCandidate,
  scored: ScoredAlumniPeer[],
  maxEdges: number
): { nodes: CareerGraphNode[]; edges: CareerGraphEdge[] } => {
  const nodes: CareerGraphNode[] = [
    {
      id: self.id,
      fullName: self.fullName,
      universityName: self.universityName,
      major: self.major,
      industry: self.industry,
      country: self.country,
      graduationYear: self.graduationYear,
    },
  ];
  const edges: CareerGraphEdge[] = [];
  const seen = new Set<string>();

  for (const { peer, weight, reasons } of scored) {
    if (edges.length >= maxEdges) break;
    if (!seen.has(peer.id)) {
      seen.add(peer.id);
      nodes.push({
        id: peer.id,
        fullName: peer.fullName,
        universityName: peer.universityName,
        major: peer.major,
        industry: peer.industry,
        country: peer.country,
        graduationYear: peer.graduationYear,
      });
    }
    edges.push({ source: self.id, target: peer.id, weight, reasons });
  }

  return { nodes, edges };
};
