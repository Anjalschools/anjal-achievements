export type AlumniBadgeUser = {
  accountType?: "student" | "alumni";
  alumniProfile?: {
    isVerifiedAlumni?: boolean;
  };
};

export type AlumniStoryListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  graduationYear: number | null;
  universityName: string | null;
  currentCompany: string | null;
  currentPosition: string | null;
  featured: boolean;
  publishedAt: string | null;
};

export type AlumniStoryDetail = AlumniStoryListItem & {
  content: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  relatedUserId: string | null;
};

export type AlumniOpportunityItem = {
  id: string;
  title: string;
  description: string | null;
  type: "mentorship" | "internship" | "job" | "workshop" | "speaking" | "partnership";
  company: string | null;
  location: string | null;
  remote: boolean;
  contactEmail: string | null;
  applicationUrl: string | null;
  featured: boolean;
  expiresAt: string | null;
};

export type AlumniMentorItem = {
  id: string;
  fullName: string;
  universityName: string | null;
  company: string | null;
  expertise: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  graduationYear: number | null;
  linkedinUrl: string | null;
  mentoringAvailable: boolean;
};
