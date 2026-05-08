export type AlumniPublicSummaryStats = {
  totalAlumni: number;
  universities: number;
  countries: number;
  featuredAlumni: number;
  companies: number;
  mentorshipAvailable: number;
};

export type AlumniSummaryResponse = {
  ok: true;
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
