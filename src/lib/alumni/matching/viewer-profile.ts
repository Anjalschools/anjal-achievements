import type { MatchProfileInput } from "./mentor-matching";

type LeanUser = {
  _id: unknown;
  alumniProfile?: MatchProfileInput & { interests?: string[] };
};

export const buildViewerMatchProfile = (
  user: LeanUser | null | undefined,
  sp?: URLSearchParams
): MatchProfileInput => {
  const ap = user?.alumniProfile || {};
  const merge = (key: keyof MatchProfileInput, param: string): string | undefined => {
    const fromUrl = sp?.get(param)?.trim();
    if (fromUrl) return fromUrl;
    const v = ap[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };

  const gy = ap.graduationYear ?? (sp?.get("graduationYear") ? Number(sp.get("graduationYear")) : undefined);

  return {
    universityName: merge("universityName", "university"),
    major: merge("major", "major"),
    industry: merge("industry", "industry"),
    country: merge("country", "country"),
    studyCountry: merge("studyCountry", "studyCountry"),
    graduationYear: Number.isFinite(gy) ? gy : undefined,
    interests: Array.isArray(ap.interests) ? ap.interests : undefined,
    mentorshipCategory: sp?.get("mentorshipCategory")?.trim() || undefined,
  };
};
