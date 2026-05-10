import bcrypt from "bcryptjs";
import User from "@/models/User";
import { ensureStudentPublicPortfolioReady } from "@/lib/public-portfolio-bootstrap";
import { queueHomeStatsRefresh } from "@/lib/home-stats-service";
import type { AlumniOnboardingActivationRow } from "./activation-types";
import { resolveAlumniPortalUsername } from "./generate-username";
import { generateUniqueAlumniStudentId } from "./generate-alumni-student-id";
import { mergeAlumniProfileFromOnboarding } from "./link-existing-user";

export const createAlumniPortalUserFromOnboarding = async (params: {
  row: AlumniOnboardingActivationRow;
  emailNorm: string;
  plainPassword: string;
}): Promise<{ userId: string }> => {
  const passwordHash = await bcrypt.hash(params.plainPassword, 10);
  const username = await resolveAlumniPortalUsername({
    emailNorm: params.emailNorm,
    fullName: params.row.fullName,
  });
  const studentId = await generateUniqueAlumniStudentId();

  const mergedProfile = mergeAlumniProfileFromOnboarding(params.row, undefined);
  mergedProfile.alumniActivationStatus = "created_new";

  const name = params.row.fullName.trim();
  const doc = await User.create({
    fullName: name || params.emailNorm,
    fullNameAr: name || params.emailNorm,
    fullNameEn: name || undefined,
    email: params.emailNorm,
    username,
    studentId,
    passwordHash,
    gender: "male",
    section: "arabic",
    grade: "g12",
    role: "student",
    status: "active",
    preferredLanguage: "ar",
    accountType: "alumni",
    mustChangePassword: true,
    phone: params.row.phone?.trim() || undefined,
    alumniProfile: mergedProfile,
  });

  await ensureStudentPublicPortfolioReady(String(doc._id));
  queueHomeStatsRefresh();

  return { userId: String(doc._id) };
};
