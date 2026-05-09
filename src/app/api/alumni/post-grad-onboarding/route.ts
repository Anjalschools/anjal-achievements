import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import { getAccountType } from "@/lib/account-type";
import User from "@/models/User";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

const MIN_YEAR = 1985;
const MAX_YEAR = new Date().getFullYear() + 2;

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentDbUser();
    if (!user?._id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const u = user as IUser;
    if (getAccountType(u) !== "alumni") {
      return NextResponse.json({ error: "ALUMNI_ONLY" }, { status: 403 });
    }
    if (u.needsAlumniOnboarding !== true) {
      return NextResponse.json({ error: "ONBOARDING_NOT_REQUIRED" }, { status: 400 });
    }

    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const universityName = sanitizeUserText(String(body.universityName || "")).trim();
    const major = sanitizeUserText(String(body.major || "")).trim();
    const studyCountry = sanitizeUserText(String(body.studyCountry || "")).trim();
    const industry = sanitizeUserText(String(body.industry || "")).trim();
    const admissionYear = Number(body.universityAdmissionYear);
    const linkedinRaw = typeof body.linkedinUrl === "string" ? body.linkedinUrl.trim() : "";
    const linkedinUrl = linkedinRaw ? sanitizeUserText(linkedinRaw) : "";
    const futureNotes = sanitizeUserText(String(body.futureSkillsNotes || "")).trim();

    const interestsRaw = body.interests;
    const interests: string[] = Array.isArray(interestsRaw)
      ? interestsRaw
          .map((x) => sanitizeUserText(String(x ?? "")).trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];

    if (!universityName || !major || !studyCountry || !industry) {
      return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
    }
    if (!Number.isFinite(admissionYear) || admissionYear < MIN_YEAR || admissionYear > MAX_YEAR) {
      return NextResponse.json({ error: "INVALID_ADMISSION_YEAR" }, { status: 400 });
    }
    if (interests.length < 1) {
      return NextResponse.json({ error: "INTERESTS_REQUIRED" }, { status: 400 });
    }

    if (linkedinUrl && !/^https?:\/\//i.test(linkedinUrl)) {
      return NextResponse.json({ error: "INVALID_LINKEDIN_URL" }, { status: 400 });
    }

    const uid = String(user._id);
    const email = String(u.email || "");

    const $set: Record<string, unknown> = {
      needsAlumniOnboarding: false,
      completedAlumniOnboardingAt: new Date(),
      "alumniProfile.universityName": universityName,
      "alumniProfile.major": major,
      "alumniProfile.universityAdmissionYear": admissionYear,
      "alumniProfile.studyCountry": studyCountry,
      "alumniProfile.industry": industry,
      "alumniProfile.interests": interests,
      "alumniProfile.alumniActivationStatus": "active",
    };
    if (linkedinUrl) {
      $set["alumniProfile.linkedinUrl"] = linkedinUrl;
    }
    if (futureNotes) {
      $set["alumniProfile.bio"] = futureNotes;
    }

    const update: { $set: Record<string, unknown>; $unset?: Record<string, string> } = { $set };
    if (!linkedinUrl) {
      update.$unset = { "alumniProfile.linkedinUrl": "" };
    }

    const res = await User.updateOne({ _id: user._id, needsAlumniOnboarding: true }, update);

    if (res.modifiedCount < 1) {
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
    }

    invalidateSessionUserCache(uid, email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/alumni/post-grad-onboarding]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
