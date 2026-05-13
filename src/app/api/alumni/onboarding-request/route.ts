import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import User from "@/models/User";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import {
  ALUMNI_ONBOARDING_DEGREE_OPTIONS,
  type AlumniOnboardingRequestInput,
} from "@/lib/alumni/onboarding-types";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";
import { createSelfRegisteredAlumniUser } from "@/lib/alumni/account-activation/create-alumni-user";
import { sendSelfRegisteredAlumniWelcomeEmail } from "@/lib/alumni/account-activation/send-activation-email";
import { runAlumniPortalAccountSideEffects } from "@/lib/alumni/account-activation/activation-service";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import { recomputeAlumniReputationGraph } from "@/lib/alumni/reputation-graph/recompute";
import type { AlumniOnboardingActivationRow } from "@/lib/alumni/account-activation/activation-types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_URL_RE = /^https?:\/\/(www\.)?linkedin\.com\/.+/i;
const MIN_GRAD_YEAR = 1985;
const MAX_GRAD_YEAR = new Date().getFullYear() + 2;
const MIN_PASSWORD_LEN = 8;

const DEGREE_SET = new Set<string>(ALUMNI_ONBOARDING_DEGREE_OPTIONS);
const DEGREE_OTHER = "أخرى";

const normalizeOptionalText = (value: unknown): string | undefined => {
  const clean = sanitizeUserText(typeof value === "string" ? value : String(value ?? ""));
  return clean || undefined;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

export async function POST(request: NextRequest) {
  try {
    if (!(await checkRouteRateLimit(request, "/api/alumni/onboarding-request"))) {
      return rateLimitExceededResponse();
    }

    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const input = body as AlumniOnboardingRequestInput;

    const fullName = sanitizeUserText(String(input.fullName || ""));
    const email = String(input.email || "").trim().toLowerCase();
    const graduationYear = normalizeGraduationYearToNumber(input.graduationYear);
    const password = String(input.password || "");
    const passwordConfirm = String(input.passwordConfirm || "");

    if (!fullName || !email || graduationYear == null) {
      return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
    }
    if (!password || !passwordConfirm) {
      return NextResponse.json({ error: "MISSING_PASSWORD" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json({ error: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "PASSWORD_MISMATCH" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }
    if (graduationYear < MIN_GRAD_YEAR || graduationYear > MAX_GRAD_YEAR) {
      return NextResponse.json({ error: "INVALID_GRADUATION_YEAR" }, { status: 400 });
    }

    const linkedinUrl = normalizeOptionalText(input.linkedinUrl);
    if (linkedinUrl && !LINKEDIN_URL_RE.test(linkedinUrl)) {
      return NextResponse.json({ error: "INVALID_LINKEDIN_URL" }, { status: 400 });
    }

    const degreeRaw = normalizeOptionalText(input.degree);
    if (!degreeRaw || !DEGREE_SET.has(degreeRaw)) {
      return NextResponse.json({ error: "INVALID_DEGREE" }, { status: 400 });
    }
    let customDegree = normalizeOptionalText(input.customDegree);
    if (degreeRaw === DEGREE_OTHER) {
      if (!customDegree) {
        return NextResponse.json({ error: "CUSTOM_DEGREE_REQUIRED" }, { status: 400 });
      }
    } else {
      customDegree = undefined;
    }

    await connectDB();

    const existingByEmail = await User.findOne({ email }).select("_id").lean();
    if (existingByEmail) {
      return NextResponse.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }

    const usernameClash = await User.findOne({ username: email }).select("_id email").lean();
    if (usernameClash && String(usernameClash.email || "").trim().toLowerCase() !== email) {
      return NextResponse.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }

    await AlumniOnboardingRequest.updateMany(
      { email, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewNotes: "superseded_by_instant_self_registration",
          reviewedAt: new Date(),
        },
      }
    );

    const services = {
      mentoring: input.services?.mentoring === true,
      internships: input.services?.internships === true,
      jobs: input.services?.jobs === true,
      workshops: input.services?.workshops === true,
      judging: input.services?.judging === true,
      sponsorship: input.services?.sponsorship === true,
    };

    const activationRow: Omit<AlumniOnboardingActivationRow, "_id"> = {
      userId: null,
      fullName,
      email,
      phone: normalizeOptionalText(input.phone) ?? null,
      graduationYear,
      universityName: normalizeOptionalText(input.universityName) ?? null,
      major: normalizeOptionalText(input.major) ?? null,
      degree: degreeRaw,
      customDegree: customDegree ?? null,
      studyCountry: normalizeOptionalText(input.studyCountry) ?? null,
      currentCompany: normalizeOptionalText(input.currentCompany) ?? null,
      currentPosition: normalizeOptionalText(input.currentPosition) ?? null,
      industry: normalizeOptionalText(input.industry) ?? null,
      linkedinUrl: linkedinUrl ?? null,
      city: normalizeOptionalText(input.city) ?? null,
      country: normalizeOptionalText(input.country) ?? null,
      bio: normalizeOptionalText(input.bio) ?? null,
      services,
    };

    let createdUserId: string;
    try {
      const created = await createSelfRegisteredAlumniUser({
        row: activationRow,
        emailNorm: email,
        plainPassword: password,
      });
      createdUserId = created.userId;
    } catch (e) {
      if (isDuplicateKeyError(e)) {
        return NextResponse.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
      }
      throw e;
    }

    const oid = new mongoose.Types.ObjectId(createdUserId);

    let auditRequestId: string | null = null;
    try {
      const auditRequest = await AlumniOnboardingRequest.create({
        userId: oid,
        fullName,
        email,
        phone: normalizeOptionalText(input.phone),
        graduationYear,
        universityName: normalizeOptionalText(input.universityName),
        major: normalizeOptionalText(input.major),
        degree: degreeRaw,
        customDegree,
        studyCountry: normalizeOptionalText(input.studyCountry),
        currentCompany: normalizeOptionalText(input.currentCompany),
        currentPosition: normalizeOptionalText(input.currentPosition),
        industry: normalizeOptionalText(input.industry),
        linkedinUrl,
        city: normalizeOptionalText(input.city),
        country: normalizeOptionalText(input.country),
        bio: normalizeOptionalText(input.bio),
        services,
        status: "approved",
        reviewedAt: new Date(),
        reviewNotes: "instant_self_registration",
        alumniActivationStatus: "active",
      });
      auditRequestId = auditRequest._id.toString();
    } catch (auditErr) {
      console.error("[alumni self-registration] audit onboarding row failed", auditErr);
    }

    try {
      await recomputeAlumniReputationGraph(oid);
    } catch (repErr) {
      console.warn("[alumni self-registration] reputation recompute skipped", repErr);
    }

    invalidateSessionUserCache(createdUserId, email);

    await runAlumniPortalAccountSideEffects(createdUserId);

    let welcomeEmailSent = false;
    try {
      welcomeEmailSent = await sendSelfRegisteredAlumniWelcomeEmail({
        to: email,
        recipientName: fullName,
        services,
      });
    } catch (mailErr) {
      console.warn("[alumni self-registration] welcome email skipped", mailErr);
    }

    return NextResponse.json(
      {
        ok: true,
        userId: createdUserId,
        requestId: auditRequestId,
        status: "active",
        welcomeEmailSent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/alumni/onboarding-request]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
