export type AlumniOnboardingStatus = "pending" | "approved" | "rejected";

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
  createdAt: string;
  updatedAt: string;
};
