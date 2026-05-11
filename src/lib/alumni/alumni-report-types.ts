import type { AlumniVerificationSource } from "@/models/User";

export type AlumniReportKind =
  | "overview"
  | "universities"
  | "careers"
  | "community"
  | "verification"
  | "reputation";

export type AlumniReportVerificationTicketFilter = "all" | "pending" | "approved" | "rejected" | "none";

export type AlumniReportFiltersState = {
  /** Space-separated search; Arabic digits normalized server-side */
  q: string;
  graduationYears: number[];
  universities: string[];
  studyCountries: string[];
  majors: string[];
  genders: Array<"male" | "female">;
  /** Profile flag */
  verifiedAlumni: "all" | "yes" | "no";
  verificationTiers: Array<"basic" | "academic" | "career" | "institution" | "global">;
  verificationSources: AlumniVerificationSource[];
  verificationTicket: AlumniReportVerificationTicketFilter;
  activationStatuses: string[];
  reputationTiers: string[];
  hasOpportunities: "all" | "yes" | "no";
  hasStories: "all" | "yes" | "no";
  hasMemories: "all" | "yes" | "no";
  mentorFilter: "all" | "yes" | "no";
  currentCountries: string[];
  industries: string[];
  /** Reserved for future numeric field on profile */
  experienceYearsMin: number | null;
  experienceYearsMax: number | null;
};

export const DEFAULT_ALUMNI_REPORT_FILTERS = (): AlumniReportFiltersState => ({
  q: "",
  graduationYears: [],
  universities: [],
  studyCountries: [],
  majors: [],
  genders: [],
  verifiedAlumni: "all",
  verificationTiers: [],
  verificationSources: [],
  verificationTicket: "all",
  activationStatuses: [],
  reputationTiers: [],
  hasOpportunities: "all",
  hasStories: "all",
  hasMemories: "all",
  mentorFilter: "all",
  currentCountries: [],
  industries: [],
  experienceYearsMin: null,
  experienceYearsMax: null,
});

/** Flat row returned to the admin UI + exports (string-heavy for Excel/PDF). */
export type AlumniReportRow = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  phone: string;
  gender: string;
  graduationYear: string;
  grade: string;
  section: string;
  activationStatus: string;
  universityName: string;
  studyCountry: string;
  degree: string;
  major: string;
  jobTitle: string;
  company: string;
  industry: string;
  skills: string;
  interests: string;
  storyCount: number;
  storyPublishedCount: number;
  opportunityCount: number;
  memoryTotalCount: number;
  memoryApprovedCount: string;
  offersMentoring: string;
  mentorCases: number;
  reputationScore: string;
  trustScore: string;
  repBadges: string;
  repTiers: string;
  networkStrength: string;
  mentorshipSub: string;
  communitySub: string;
  careerSub: string;
  verificationSub: string;
  contentSub: string;
  eventSub: string;
  isVerifiedAlumni: string;
  verificationTier: string;
  verificationSource: string;
  verificationTicketStatus: string;
  lastLoginAt: string;
  updatedAt: string;
};

export type AlumniReportUniversityAggRow = {
  universityName: string;
  alumniCount: number;
  verifiedCount: number;
  topStudyCountry: string;
  topMajor: string;
};

export type AlumniReportCareerAggRow = {
  industry: string;
  position: string;
  count: number;
  avgReputation: string;
};

export type AlumniReportCommunityAgg = {
  storiesTotal: number;
  storiesPublished: number;
  opportunitiesByUser: number;
  memoryPostsTotal: number;
  memoryPostsApproved: number;
  mentorshipRequestsTotal: number;
  topStoryAuthors: { userId: string; name: string; count: number }[];
};

export type AlumniReportVerificationAgg = {
  profileVerified: number;
  profileUnverified: number;
  ticketsPending: number;
  ticketsApproved: number;
  ticketsRejected: number;
  bySource: { source: string; count: number }[];
  byTier: { tier: string; count: number }[];
};

export type AlumniReportReputationAggRow = {
  userId: string;
  fullName: string;
  email: string;
  reputationScore: number;
  trustScore: string;
  badges: string;
  tiers: string;
  networkStrength: number;
};

export type AlumniReportSummary = {
  alumniCount: number;
  distinctUniversities: number;
  distinctCountries: number;
  mentorsOffering: number;
  opportunityRows: number;
  storyCount: number;
  memoryApproved: number;
  avgReputation: string;
  topCohortYear: string;
  topUniversity: string;
};

export type AlumniReportMeta = {
  graduationYears: number[];
  universities: string[];
  studyCountries: string[];
  majors: string[];
  currentCountries: string[];
  industries: string[];
};
