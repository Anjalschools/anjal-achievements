import type { MatchProfileInput } from "./mentor-matching";

export type CohortPeer = {
  id: string;
  fullName: string;
  universityName?: string | null;
  major?: string | null;
  industry?: string | null;
  currentCompany?: string | null;
  reputationScore?: number | null;
  updatedAt?: Date | null;
};

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/** Peers in same cohort year with similar university / major / industry */
export const scoreCohortPeer = (
  anchor: MatchProfileInput,
  peer: CohortPeer,
  selfId?: string
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  if (selfId && peer.id === selfId) return { score: -1, reasons: [] };
  let score = 0;

  const au = norm(anchor.universityName);
  const pu = norm(peer.universityName);
  if (au && pu && au === pu) {
    score += 35;
    reasons.push("same_university");
  }

  const am = norm(anchor.major);
  const pm = norm(peer.major);
  if (am && pm && (am === pm || am.includes(pm) || pm.includes(am))) {
    score += 30;
    reasons.push("same_major");
  }

  const ai = norm(anchor.industry);
  const pi = norm(peer.industry);
  if (ai && pi && (ai === pi || ai.includes(pi) || pi.includes(ai))) {
    score += 25;
    reasons.push("same_industry");
  }

  const rs = Number(peer.reputationScore || 0);
  if (rs > 0) {
    score += Math.min(15, Math.floor(rs / 30));
    reasons.push("reputation");
  }

  const days = peer.updatedAt ? (Date.now() - new Date(peer.updatedAt).getTime()) / (1000 * 60 * 60 * 24) : 9999;
  if (days <= 60) {
    score += 10;
    reasons.push("recently_active");
  }

  return { score, reasons };
};

export const rankCohortPeers = (
  anchor: MatchProfileInput,
  peers: CohortPeer[],
  selfId?: string,
  limit = 8
): Array<CohortPeer & { similarityScore: number; similarityReasons: string[] }> => {
  return peers
    .map((p) => {
      const { score, reasons } = scoreCohortPeer(anchor, p, selfId);
      return { ...p, similarityScore: score, similarityReasons: reasons };
    })
    .filter((x) => x.similarityScore >= 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
};
