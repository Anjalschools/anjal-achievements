import { NextRequest, NextResponse } from "next/server";
import connectDB, { logDbReadyState, pingMongo } from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import User from "@/models/User";
import Achievement from "@/models/Achievement";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import { computeAlumniBadges } from "@/lib/alumni/compute-alumni-badges";
import { computeAlumniProfileCompletionPct } from "@/lib/alumni/compute-profile-completion";
import { normalizeGrade, getGradeLabel } from "@/constants/grades";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import {
  mergeNotificationPrefs,
  mergePrivacyPrefs,
  newPasswordMeetsPolicy,
  isValidSaMobile,
} from "@/lib/user-account-preferences";
import type { IUser } from "@/models/User";
import { getAccountType } from "@/lib/account-type";
import { resolveEffectiveStaffScope } from "@/lib/user-scope";
import {
  normalizeStudentPortfolioContentFromDoc,
  parseStudentPortfolioContentInput,
} from "@/lib/student-portfolio-content";
import { userMayAdministerAlumni } from "@/lib/alumni/alumni-administration-access";

export const dynamic = "force-dynamic";

const buildOrganizationalAccessPayload = (
  user: IUser
): {
  mode: "full" | "scoped";
  genders?: string[];
  sections?: string[];
  grades?: string[];
} | null => {
  const roleStr = String(user.role || "");
  if (roleStr === "student") return null;
  const scope = resolveEffectiveStaffScope(user);
  if (scope.unrestricted) return { mode: "full" };
  return {
    mode: "scoped",
    genders: scope.genders,
    sections: scope.sections,
    grades: scope.grades,
  };
};

// GET user profile
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    logDbReadyState("profileGET");
    const pingOk = await pingMongo();
    if (!pingOk) {
      return NextResponse.json(
        { ok: false, code: "DB_UNAVAILABLE", message: "Database unavailable" },
        { status: 503 }
      );
    }

    const user = await getCurrentDbUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const u = user as unknown as {
      createdAt?: Date;
      lastLoginAt?: Date;
      status?: string;
    };

    const nu = user as typeof user & {
      notificationPreferences?: Record<string, boolean>;
      privacyPreferences?: Record<string, boolean>;
    };

    const organizationalAccess = buildOrganizationalAccessPayload(user as IUser);
    const ap = (user as IUser).alumniProfile || {};
    const completedAt = (user as IUser).completedAlumniOnboardingAt;
    const alumniAdministrationAccess = await userMayAdministerAlumni(user as IUser);

    const accountTypeVal = getAccountType(user as IUser);
    let alumniBadges: string[] | undefined;
    let alumniProfileCompletion:
      | {
          pct: number;
          filled: number;
          total: number;
          breakdown: Record<string, boolean>;
        }
      | undefined;

    if (accountTypeVal === "alumni") {
      const [certificateCount, mentorshipParticipationCount] = await Promise.all([
        Achievement.countDocuments({
          userId: user._id,
          approved: true,
          certificateIssuedAt: { $exists: true, $ne: null },
        }),
        AlumniMentorshipRequest.countDocuments({
          requesterId: user._id,
          status: { $in: ["pending", "accepted", "completed"] },
        }),
      ]);

      const spc = normalizeStudentPortfolioContentFromDoc(
        (user as unknown as { studentPortfolioContent?: unknown }).studentPortfolioContent
      );

      alumniBadges = computeAlumniBadges(
        {
          createdAt: u.createdAt,
          profilePhoto: user.profilePhoto,
          lastLoginAt: u.lastLoginAt,
          updatedAt: (user as unknown as { updatedAt?: Date }).updatedAt,
          completedAlumniOnboardingAt: completedAt,
          accountType: "alumni",
          alumniProfile: {
            ...ap,
            memoryPosts: Array.isArray((ap as { memoryPosts?: { status?: string }[] }).memoryPosts)
              ? (ap as { memoryPosts: { status?: string }[] }).memoryPosts
              : undefined,
            badges: Array.isArray((ap as { badges?: string[] }).badges)
              ? (ap as { badges?: string[] }).badges
              : undefined,
          },
          studentPortfolioContent: spc || undefined,
        },
        { certificateCount, mentorshipParticipationCount }
      );

      const comp = computeAlumniProfileCompletionPct(
        {
          profilePhoto: user.profilePhoto,
          alumniProfile: {
            universityName: ap.universityName,
            major: ap.major,
            currentCompany: ap.currentCompany,
            currentPosition: ap.currentPosition,
            bio: ap.bio,
            linkedinUrl: ap.linkedinUrl,
            interests: Array.isArray(ap.interests) ? ap.interests : [],
          },
          studentPortfolioContent: spc || undefined,
        },
        certificateCount
      );
      alumniProfileCompletion = {
        pct: comp.pct,
        filled: comp.filled,
        total: comp.total,
        breakdown: comp.breakdown as Record<string, boolean>,
      };
    }

    return NextResponse.json({
      id: user._id.toString(),
      accountType: getAccountType(user as IUser),
      fullName: user.fullName,
      fullNameAr: user.fullNameAr || user.fullName,
      fullNameEn: user.fullNameEn || "",
      email: user.email,
      username: user.username,
      studentId: user.studentId,
      nationalId: user.nationalId || "",
      gender: user.gender,
      isMawhibaStudent: (user as IUser).isMawhibaStudent === true,
      grade: user.grade,
      gradeLabel: getGradeLabel(user.grade, user.preferredLanguage || "ar"),
      section: user.section === "arabic" ? "عربي" : "دولي",
      sectionRaw: user.section,
      phone: user.phone || "",
      guardianName: user.guardianName || "",
      guardianPhone: user.guardianPhone || "",
      guardianNationalId: user.guardianNationalId || "",
      profilePhoto: user.profilePhoto,
      role: user.role,
      alumniAdministrationAccess,
      preferredLanguage: user.preferredLanguage,
      notifications: mergeNotificationPrefs(nu.notificationPreferences),
      privacy: mergePrivacyPrefs(nu.privacyPreferences),
      accountStatus: u.status || "active",
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : undefined,
      lastLoginAt: u.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : null,
      organizationalAccess,
      staffScope: (user as IUser).staffScope ?? null,
      studentPortfolioContent: normalizeStudentPortfolioContentFromDoc(
        (user as unknown as { studentPortfolioContent?: unknown }).studentPortfolioContent
      ),
      mustChangePassword: (user as unknown as { mustChangePassword?: boolean }).mustChangePassword === true,
      needsAlumniOnboarding: (user as IUser).needsAlumniOnboarding === true,
      completedAlumniOnboardingAt:
        completedAt instanceof Date ? completedAt.toISOString() : null,
      alumniOnboardingPrefill: {
        universityName: ap.universityName || "",
        major: ap.major || "",
        universityAdmissionYear: ap.universityAdmissionYear ?? null,
        studyCountry: ap.studyCountry || "",
        industry: ap.industry || "",
        interests: Array.isArray(ap.interests) ? ap.interests : [],
        linkedinUrl: ap.linkedinUrl || "",
        futureSkillsNotes: ap.bio || "",
      },
      alumniActivationStatus: ap.alumniActivationStatus || null,
      alumniCommunityRemovedAt:
        (user as IUser).alumniCommunityRemovedAt instanceof Date
          ? (user as IUser).alumniCommunityRemovedAt!.toISOString()
          : null,
      alumniPermanentlyPurgedAt:
        (user as IUser).alumniPermanentlyPurgedAt instanceof Date
          ? (user as IUser).alumniPermanentlyPurgedAt!.toISOString()
          : null,
      alumniBadges,
      alumniProfileCompletion,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[profile:GET:error]", {
      message: err.message,
      stack: err.stack,
      hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
      nodeEnv: process.env.NODE_ENV ?? "(unset)",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// UPDATE user profile
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    logDbReadyState("profilePUT");
    const pingPutOk = await pingMongo();
    if (!pingPutOk) {
      return NextResponse.json(
        { ok: false, code: "DB_UNAVAILABLE", message: "Database unavailable" },
        { status: 503 }
      );
    }

    const currentUser = await getCurrentDbUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      fullName,
      fullNameAr,
      fullNameEn,
      phone,
      gender,
      section,
      grade,
      guardianName,
      guardianPhone,
      guardianNationalId,
      preferredLanguage,
      currentPassword,
      newPassword,
      profilePhoto, // Base64 or URL string
      notifications,
      privacy,
      studentPortfolioContent,
    } = body;

    // Ignore immutable fields: email, username, studentId, nationalId
    // These should not be updated through this endpoint

    const updateData: Record<string, unknown> = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (fullNameAr !== undefined) updateData.fullNameAr = fullNameAr ? fullNameAr.trim() : undefined;
    if (fullNameEn !== undefined) updateData.fullNameEn = fullNameEn ? fullNameEn.trim() : undefined;
    if (phone !== undefined && phone !== null && String(phone).trim() !== "") {
      const p = String(phone).trim();
      if (!isValidSaMobile(p)) {
        return NextResponse.json(
          { error: "Invalid phone number (use 10 digits starting with 05)" },
          { status: 400 }
        );
      }
      updateData.phone = p.replace(/\D/g, "");
    }
    if (gender) updateData.gender = gender;
    if (section) updateData.section = section;
    if (grade) {
      const normalized = normalizeGrade(grade);
      updateData.grade = normalized || grade.trim();
    }
    if (guardianName !== undefined) updateData.guardianName = guardianName ? guardianName.trim() : undefined;
    if (guardianPhone !== undefined) {
      if (guardianPhone === null || String(guardianPhone).trim() === "") {
        updateData.guardianPhone = undefined;
      } else {
        const g = String(guardianPhone).trim();
        if (!isValidSaMobile(g)) {
          return NextResponse.json(
            { error: "Invalid guardian phone (use 10 digits starting with 05)" },
            { status: 400 }
          );
        }
        updateData.guardianPhone = g.replace(/\D/g, "");
      }
    }
    if (guardianNationalId !== undefined) updateData.guardianNationalId = guardianNationalId ? guardianNationalId.trim() : undefined;
    if (preferredLanguage) updateData.preferredLanguage = preferredLanguage;
    if (profilePhoto) {
      updateData.profilePhoto = profilePhoto;
    }

    if (notifications && typeof notifications === "object" && !Array.isArray(notifications)) {
      const cur = (currentUser as { notificationPreferences?: Record<string, boolean> })
        .notificationPreferences;
      updateData.notificationPreferences = mergeNotificationPrefs({
        ...cur,
        ...(notifications as Record<string, boolean>),
      });
    }

    if (privacy && typeof privacy === "object" && !Array.isArray(privacy)) {
      const curP = (currentUser as { privacyPreferences?: Record<string, boolean> })
        .privacyPreferences;
      updateData.privacyPreferences = mergePrivacyPrefs({
        ...curP,
        ...(privacy as Record<string, boolean>),
      });
    }

    if (studentPortfolioContent !== undefined) {
      const parsed = parseStudentPortfolioContentInput(studentPortfolioContent);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      updateData.studentPortfolioContent = parsed.value;
    }

    // Handle password change if provided
    if (newPassword && currentPassword) {
      if (!newPasswordMeetsPolicy(String(newPassword))) {
        return NextResponse.json(
          {
            error:
              "New password must be at least 8 characters and include an uppercase letter and a number",
          },
          { status: 400 }
        );
      }
      const bcrypt = await import("bcryptjs");
      const secretRow = await User.findById(currentUser._id).select("+passwordHash").lean();
      const currentHash =
        secretRow && typeof (secretRow as { passwordHash?: string }).passwordHash === "string"
          ? (secretRow as { passwordHash: string }).passwordHash
          : "";
      const isPasswordValid = await bcrypt.compare(currentPassword, currentHash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }
      // Hash new password
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
      updateData.mustChangePassword = false;
    }

    const user = await User.findByIdAndUpdate(
      currentUser._id,
      { $set: updateData },
      { returnDocument: "after", runValidators: true }
    ).select("-passwordHash");

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    invalidateSessionUserCache(currentUser._id?.toString(), currentUser.email);

    const uu = user as unknown as {
      createdAt?: Date;
      lastLoginAt?: Date;
      status?: string;
    };

    const uOut = user as typeof user & {
      notificationPreferences?: Record<string, boolean>;
      privacyPreferences?: Record<string, boolean>;
    };

    return NextResponse.json({
      id: user._id.toString(),
      accountType: getAccountType(user as IUser),
      fullName: user.fullName,
      fullNameAr: user.fullNameAr || user.fullName,
      fullNameEn: user.fullNameEn || "",
      email: user.email,
      username: user.username,
      studentId: user.studentId,
      nationalId: user.nationalId || "",
      gender: user.gender,
      isMawhibaStudent: (user as IUser).isMawhibaStudent === true,
      grade: user.grade,
      gradeLabel: getGradeLabel(user.grade, user.preferredLanguage || "ar"),
      section: user.section === "arabic" ? "عربي" : "دولي",
      sectionRaw: user.section,
      phone: user.phone || "",
      guardianName: user.guardianName || "",
      guardianPhone: user.guardianPhone || "",
      guardianNationalId: user.guardianNationalId || "",
      profilePhoto: user.profilePhoto,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      notifications: mergeNotificationPrefs(uOut.notificationPreferences),
      privacy: mergePrivacyPrefs(uOut.privacyPreferences),
      accountStatus: uu.status || "active",
      createdAt: uu.createdAt instanceof Date ? uu.createdAt.toISOString() : undefined,
      lastLoginAt: uu.lastLoginAt instanceof Date ? uu.lastLoginAt.toISOString() : null,
      organizationalAccess: buildOrganizationalAccessPayload(user as IUser),
      staffScope: (user as IUser).staffScope ?? null,
      studentPortfolioContent: normalizeStudentPortfolioContentFromDoc(
        (user as unknown as { studentPortfolioContent?: unknown }).studentPortfolioContent
      ),
      mustChangePassword: (user as unknown as { mustChangePassword?: boolean }).mustChangePassword === true,
      needsAlumniOnboarding: (user as IUser).needsAlumniOnboarding === true,
      completedAlumniOnboardingAt:
        (user as IUser).completedAlumniOnboardingAt instanceof Date
          ? (user as IUser).completedAlumniOnboardingAt!.toISOString()
          : null,
      alumniActivationStatus: (user as IUser).alumniProfile?.alumniActivationStatus || null,
    });
  } catch (error: any) {
    console.error("Error updating user profile:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { error: `User already exists with this ${field}` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
