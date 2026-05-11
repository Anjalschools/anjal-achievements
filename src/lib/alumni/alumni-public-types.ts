export type AlumniPublicSummaryStats = {
  totalAlumni: number;
  universities: number;
  countries: number;
  companies: number;
  /** Alumni with an international study country recorded (non-empty). */
  globalParticipation: number;
  mentorshipAvailable: number;
  /** Distinct featured alumni count; optional for backward-compatible consumers. */
  featuredAlumni?: number;
};

export type AlumniSummaryResponse = {
  ok: true;
  /** Additive — public hero consumers may prefer `success`. */
  success?: true;
  stats: AlumniPublicSummaryStats;
};

export type FeaturedAlumniItem = {
  id: string;
  fullName: string;
  graduationYear: number | null;
  universityName: string | null;
  currentPosition: string | null;
  currentCompany: string | null;
  bio: string | null;
  avatar: string | null;
  /** Phase 4 — optional verification signals for public cards */
  isVerifiedAlumni?: boolean;
  verificationTier?: "basic" | "academic" | "career" | "institution" | "global";
  trustScore?: number | null;
};

export type FeaturedAlumniResponse = {
  ok: true;
  items: FeaturedAlumniItem[];
};

export type AlumniUniversityCountItem = {
  name: string;
  count: number;
};

export type AlumniUniversitiesResponse = {
  ok: true;
  items: AlumniUniversityCountItem[];
};

export type AlumniFieldCountItem = {
  field: string;
  count: number;
};

export type AlumniFieldsResponse = {
  ok: true;
  items: AlumniFieldCountItem[];
};
