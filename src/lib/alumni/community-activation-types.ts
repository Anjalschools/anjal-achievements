export type CommunityFeedKind =
  | "member_joined"
  | "job_update"
  | "memory_shared"
  | "certificate_added"
  | "portfolio_live"
  | "mentor_live"
  | "pulse";

export type CommunityFeedItem = {
  id: string;
  kind: CommunityFeedKind;
  at: string;
  actorId: string;
  actorName: string;
  actorPhoto: string | null;
  href: string;
  meta?: string;
};

export type CommunityInsights = {
  topUniversities: { name: string; count: number }[];
  topMajors: { name: string; count: number }[];
  topIndustries: { name: string; count: number }[];
  opportunities: { id: string; title: string; type: string }[];
};
