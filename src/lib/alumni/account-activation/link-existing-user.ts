import User, { type IUser, type AlumniProfile } from "@/models/User";
import type { AlumniOnboardingActivationRow } from "./activation-types";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";

type UserDoc = InstanceType<typeof User>;

export const mergeAlumniProfileFromOnboarding = (
  row: AlumniOnboardingActivationRow,
  prev?: AlumniProfile
): AlumniProfile => {
  const reqDeg = row.degree ? String(row.degree).trim() : "";
  const reqCustom = row.customDegree ? String(row.customDegree).trim() : "";
  const resolvedDegree =
    reqDeg === "أخرى" ? reqCustom || prev?.degree || reqDeg : reqDeg || prev?.degree;

  const fromRow = row.services || {};

  const fromRowGy = normalizeGraduationYearToNumber(row.graduationYear);
  const prevGy = normalizeGraduationYearToNumber(prev?.graduationYear);

  return {
    graduationYear: fromRowGy ?? prevGy,
    universityName: row.universityName || prev?.universityName,
    major: row.major || prev?.major,
    degree: resolvedDegree || prev?.degree,
    studyCountry: row.studyCountry || prev?.studyCountry,
    currentCompany: row.currentCompany || prev?.currentCompany,
    currentPosition: row.currentPosition || prev?.currentPosition,
    industry: row.industry || prev?.industry,
    linkedinUrl: row.linkedinUrl || prev?.linkedinUrl,
    city: row.city || prev?.city,
    country: row.country || prev?.country,
    bio: row.bio || prev?.bio,
    isFeaturedAlumni: prev?.isFeaturedAlumni,
    isVerifiedAlumni: prev?.isVerifiedAlumni,
    verifiedAt: prev?.verifiedAt,
    verifiedById: prev?.verifiedById,
    verificationSource: prev?.verificationSource,
    reputationScore: prev?.reputationScore,
    interests: prev?.interests,
    isAmbassadorAlumni: prev?.isAmbassadorAlumni,
    isDistinguishedAlumni: prev?.isDistinguishedAlumni,
    privacySettings: prev?.privacySettings,
    verificationTier: prev?.verificationTier,
    trustScore: prev?.trustScore,
    alumniServices: {
      mentoring: fromRow.mentoring === true || prev?.alumniServices?.mentoring === true,
      internships: fromRow.internships === true || prev?.alumniServices?.internships === true,
      jobs: fromRow.jobs === true || prev?.alumniServices?.jobs === true,
      workshops: fromRow.workshops === true || prev?.alumniServices?.workshops === true,
      judging: fromRow.judging === true || prev?.alumniServices?.judging === true,
      sponsorship: fromRow.sponsorship === true || prev?.alumniServices?.sponsorship === true,
    },
  };
};

/**
 * Attach onboarding payload to an existing portal user without destructive overwrites.
 */
export const applyAlumniOnboardingToExistingUser = async (
  user: UserDoc,
  row: AlumniOnboardingActivationRow,
  emailNorm: string
): Promise<void> => {
  const u = user as unknown as IUser;
  if (String(u.email || "").trim().toLowerCase() !== emailNorm) {
    throw new Error("EMAIL_MISMATCH");
  }

  const role = String(u.role || "");
  const prev = u.alumniProfile || {};
  const merged = mergeAlumniProfileFromOnboarding(row, prev);
  merged.alumniActivationStatus = "linked_existing";

  user.set("alumniProfile", merged);

  if (role === "student" || u.accountType === "alumni") {
    user.set("accountType", "alumni");
  }

  const reqName = row.fullName.trim();
  if (reqName) {
    if (!String(user.get("fullNameAr") || "").trim()) user.set("fullNameAr", reqName);
    if (!String(user.get("fullName") || "").trim()) user.set("fullName", reqName);
    if (!String(user.get("fullNameEn") || "").trim()) user.set("fullNameEn", reqName);
  }

  const ph = row.phone?.trim();
  if (ph && !String(user.get("phone") || "").trim()) {
    user.set("phone", ph);
  }

  await user.save();
};
