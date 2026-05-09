export type AlumniOnboardingStatus = "pending" | "approved" | "rejected";

/** Canonical degree options for onboarding (Arabic labels). */
export const ALUMNI_ONBOARDING_DEGREE_OPTIONS = [
  "دبلوم",
  "بكالوريوس",
  "ماجستير",
  "دكتوراه",
  "زمالة",
  "طالب جامعي",
  "أخرى",
] as const;

export type AlumniOnboardingDegreeOption = (typeof ALUMNI_ONBOARDING_DEGREE_OPTIONS)[number];

export type AlumniOnboardingServicesInput = {
  mentoring?: boolean;
  internships?: boolean;
  jobs?: boolean;
  workshops?: boolean;
  judging?: boolean;
  sponsorship?: boolean;
};

export type AlumniOnboardingRequestInput = {
  fullName: string;
  email: string;
  phone?: string;
  graduationYear: number;
  universityName?: string;
  major?: string;
  degree?: string;
  /** Required when degree is "أخرى". */
  customDegree?: string;
  studyCountry?: string;
  currentCompany?: string;
  currentPosition?: string;
  industry?: string;
  linkedinUrl?: string;
  city?: string;
  country?: string;
  bio?: string;
  services?: AlumniOnboardingServicesInput;
};

export type AlumniOnboardingAdminListItem = {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  graduationYear: number;
  universityName: string | null;
  major: string | null;
  degree: string | null;
  customDegree: string | null;
  studyCountry: string | null;
  currentCompany: string | null;
  currentPosition: string | null;
  industry: string | null;
  linkedinUrl: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  services: Required<AlumniOnboardingServicesInput>;
  status: AlumniOnboardingStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  /** Last activation pipeline status (optional on legacy rows). */
  alumniActivationStatus: string | null;
  alumniActivationLastError: string | null;
  createdAt: string;
  updatedAt: string;
};
