import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import { getCurrentDbUser } from "@/lib/auth";
import { checkRouteRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { sanitizeUserText } from "@/lib/sanitize-html";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import {
  ALUMNI_ONBOARDING_DEGREE_OPTIONS,
  type AlumniOnboardingRequestInput,
} from "@/lib/alumni/onboarding-types";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINKEDIN_URL_RE = /^https?:\/\/(www\.)?linkedin\.com\/.+/i;
const MIN_GRAD_YEAR = 1985;
const MAX_GRAD_YEAR = new Date().getFullYear() + 2;

const DEGREE_SET = new Set<string>(ALUMNI_ONBOARDING_DEGREE_OPTIONS);
const DEGREE_OTHER = "أخرى";

const normalizeOptionalText = (value: unknown): string | undefined => {
  const clean = sanitizeUserText(typeof value === "string" ? value : String(value ?? ""));
  return clean || undefined;
};

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

    if (!fullName || !email || graduationYear == null) {
      return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
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

    const authUser = await getCurrentDbUser();
    const userId =
      authUser?._id && mongoose.Types.ObjectId.isValid(String(authUser._id))
        ? new mongoose.Types.ObjectId(String(authUser._id))
        : undefined;

    await connectDB();

    const duplicateFilter: Record<string, unknown> = {
      status: "pending",
      $or: [{ email }],
    };
    if (userId) {
      (duplicateFilter.$or as Array<Record<string, unknown>>).push({ userId });
    }

    const existingPending = await AlumniOnboardingRequest.findOne(duplicateFilter)
      .select("_id")
      .lean();

    if (existingPending) {
      return NextResponse.json({ error: "ALREADY_PENDING" }, { status: 409 });
    }

    const created = await AlumniOnboardingRequest.create({
      userId,
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
      services: {
        mentoring: input.services?.mentoring === true,
        internships: input.services?.internships === true,
        jobs: input.services?.jobs === true,
        workshops: input.services?.workshops === true,
        judging: input.services?.judging === true,
        sponsorship: input.services?.sponsorship === true,
      },
      status: "pending",
    });

    return NextResponse.json(
      {
        ok: true,
        requestId: created._id.toString(),
        status: "pending",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/alumni/onboarding-request]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
