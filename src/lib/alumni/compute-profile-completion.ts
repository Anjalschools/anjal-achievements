export type ProfileCompletionUserShape = {
  profilePhoto?: string | null;
  alumniProfile?: {
    universityName?: string;
    major?: string;
    currentCompany?: string;
    currentPosition?: string;
    bio?: string;
    linkedinUrl?: string;
    interests?: string[];
  } | null;
  studentPortfolioContent?: {
    bio?: string;
    technicalSkills?: string[];
    personalSkills?: string[];
  } | null;
};

export type ProfileCompletionBreakdown = {
  photo: boolean;
  university: boolean;
  major: boolean;
  job: boolean;
  bio: boolean;
  skills: boolean;
  links: boolean;
  certificates: boolean;
};

export const computeAlumniProfileCompletionPct = (
  user: ProfileCompletionUserShape,
  certificateCount: number
): { pct: number; breakdown: ProfileCompletionBreakdown; filled: number; total: number } => {
  const ap = user.alumniProfile || {};
  const sp = user.studentPortfolioContent || {};

  const bioText = String(ap.bio || sp.bio || "").trim();
  const tech = sp.technicalSkills || [];
  const pers = sp.personalSkills || [];
  const interests = ap.interests || [];

  const breakdown: ProfileCompletionBreakdown = {
    photo: Boolean(user.profilePhoto && String(user.profilePhoto).trim()),
    university: Boolean(ap.universityName && String(ap.universityName).trim()),
    major: Boolean(ap.major && String(ap.major).trim()),
    job: Boolean(
      (ap.currentCompany && String(ap.currentCompany).trim()) ||
        (ap.currentPosition && String(ap.currentPosition).trim())
    ),
    bio: bioText.length >= 24,
    skills:
      (Array.isArray(interests) && interests.length > 0) ||
      (Array.isArray(tech) && tech.length > 0) ||
      (Array.isArray(pers) && pers.length > 0),
    links: Boolean(ap.linkedinUrl && String(ap.linkedinUrl).trim().length > 8),
    certificates: certificateCount > 0,
  };

  const keys = Object.keys(breakdown) as (keyof ProfileCompletionBreakdown)[];
  const filled = keys.filter((k) => breakdown[k]).length;
  const total = keys.length;
  const pct = Math.round((filled / total) * 100);

  return { pct, breakdown, filled, total };
};
