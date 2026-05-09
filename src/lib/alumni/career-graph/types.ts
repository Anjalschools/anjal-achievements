import type { MentorCandidate } from "@/lib/alumni/matching/mentor-matching";

export type CareerGraphNode = {
  id: string;
  fullName: string;
  universityName?: string | null;
  major?: string | null;
  industry?: string | null;
  country?: string | null;
  graduationYear?: number | null;
};

export type CareerGraphEdge = {
  source: string;
  target: string;
  weight: number;
  reasons: string[];
};

export type ScoredAlumniPeer = {
  peer: MentorCandidate;
  weight: number;
  reasons: string[];
};

export type PathwayHop = {
  type: "direct" | "via_peer";
  strength: number;
  hopIds: string[];
  labels: string[];
};
