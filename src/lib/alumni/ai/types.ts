import type { MatchProfileInput } from "@/lib/alumni/matching/mentor-matching";

export type AlumniAssistantIntent =
  | "mentor_suggest"
  | "opportunity_pick"
  | "university_explorer"
  | "career_insight"
  | "network_suggest";

export type AlumniSearchHit = {
  id: string;
  fullName: string;
  universityName: string | null;
  company: string | null;
  industry: string | null;
  major: string | null;
  isVerifiedAlumni: boolean;
  mentoringAvailable: boolean;
};

export type AlumniAssistantRecommendInput = {
  intent: AlumniAssistantIntent;
  /** Optional focus: major keyword, industry, or company name fragment */
  focus?: string;
  /** Optional profile overlay for guests with sparse alumniProfile */
  profileOverlay?: Partial<MatchProfileInput>;
};
