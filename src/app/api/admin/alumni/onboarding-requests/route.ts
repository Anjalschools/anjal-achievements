import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import type {
  AlumniOnboardingAdminListItem,
  AlumniOnboardingStatus,
} from "@/lib/alumni/onboarding-types";
import { ALUMNI_ACTIVATION_STATUS_VALUES } from "@/lib/alumni/alumni-activation-ui";

export const dynamic = "force-dynamic";

const isValidStatus = (value: unknown): value is AlumniOnboardingStatus =>
  value === "pending" || value === "approved" || value === "rejected";

const isValidActivationFilter = (value: unknown): value is string =>
  typeof value === "string" &&
  value !== "" &&
  value !== "all" &&
  (ALUMNI_ACTIVATION_STATUS_VALUES as readonly string[]).includes(value);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SORT_FIELDS = new Set(["createdAt", "updatedAt", "alumniActivationStatus"]);

const serializeRow = (
  row: Record<string, unknown> & { _id: { toString(): string } }
): AlumniOnboardingAdminListItem => {
  const services = (row.services as Record<string, unknown> | undefined) || {};
  return {
    id: row._id.toString(),
    userId: row.userId ? String(row.userId) : null,
    fullName: String(row.fullName || ""),
    email: String(row.email || ""),
    phone: row.phone ? String(row.phone) : null,
    graduationYear: Number(row.graduationYear || 0),
    universityName: row.universityName ? String(row.universityName) : null,
    major: row.major ? String(row.major) : null,
    degree: row.degree ? String(row.degree) : null,
    customDegree: row.customDegree ? String(row.customDegree) : null,
    studyCountry: row.studyCountry ? String(row.studyCountry) : null,
    currentCompany: row.currentCompany ? String(row.currentCompany) : null,
    currentPosition: row.currentPosition ? String(row.currentPosition) : null,
    industry: row.industry ? String(row.industry) : null,
    linkedinUrl: row.linkedinUrl ? String(row.linkedinUrl) : null,
    city: row.city ? String(row.city) : null,
    country: row.country ? String(row.country) : null,
    bio: row.bio ? String(row.bio) : null,
    services: {
      mentoring: services.mentoring === true,
      internships: services.internships === true,
      jobs: services.jobs === true,
      workshops: services.workshops === true,
      judging: services.judging === true,
      sponsorship: services.sponsorship === true,
    },
    status: isValidStatus(row.status) ? row.status : "pending",
    reviewedById: row.reviewedById ? String(row.reviewedById) : null,
    reviewedAt: row.reviewedAt ? new Date(String(row.reviewedAt)).toISOString() : null,
    reviewNotes: row.reviewNotes ? String(row.reviewNotes) : null,
    alumniActivationStatus: row.alumniActivationStatus ? String(row.alumniActivationStatus) : null,
    alumniActivationLastError: row.alumniActivationLastError ? String(row.alumniActivationLastError) : null,
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
};

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const sp = request.nextUrl.searchParams;
    const statusParam = String(sp.get("status") || "all");
    const activationParam = sp.get("alumniActivationStatus");
    const q = sanitizeUserText(String(sp.get("q") || ""));
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;
    const sortKeyRaw = String(sp.get("sort") || "createdAt");
    const sortKey = SORT_FIELDS.has(sortKeyRaw) ? sortKeyRaw : "createdAt";
    const sortDir = String(sp.get("order") || "desc") === "asc" ? 1 : -1;

    const filter: Record<string, unknown> = {};
    if (isValidStatus(statusParam)) filter.status = statusParam;
    if (isValidActivationFilter(activationParam)) {
      filter.alumniActivationStatus = activationParam;
    }
    if (q) {
      const escaped = escapeRegExp(q);
      filter.$or = [
        { fullName: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { universityName: { $regex: escaped, $options: "i" } },
        { currentCompany: { $regex: escaped, $options: "i" } },
      ];
    }

    await connectDB();

    const sortSpec: Record<string, 1 | -1> = { [sortKey]: sortDir };
    if (sortKey !== "createdAt") {
      sortSpec.createdAt = -1;
    }

    const [items, total, pendingCount] = await Promise.all([
      AlumniOnboardingRequest.find(filter)
        .select(
          "userId fullName email phone graduationYear universityName major degree customDegree studyCountry currentCompany currentPosition industry linkedinUrl city country bio services status reviewedById reviewedAt reviewNotes alumniActivationStatus alumniActivationLastError createdAt updatedAt"
        )
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .lean<Record<string, unknown>[]>(),
      AlumniOnboardingRequest.countDocuments(filter),
      AlumniOnboardingRequest.countDocuments({ status: "pending" }),
    ]);

    return NextResponse.json({
      ok: true,
      items: items.map((row) => serializeRow(row as Record<string, unknown> & { _id: { toString(): string } })),
      total,
      page,
      limit,
      pendingCount,
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/onboarding-requests]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const requestId = String(body.requestId || "");
    const nextStatus = String(body.status || "");
    const reviewNotes = sanitizeUserText(String(body.reviewNotes || ""));

    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return NextResponse.json({ error: "INVALID_REQUEST_ID" }, { status: 400 });
    }
    if (nextStatus !== "approved" && nextStatus !== "rejected") {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }

    await connectDB();

    const row = await AlumniOnboardingRequest.findById(requestId);
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (row.status !== "pending") {
      if (row.status === nextStatus) {
        return NextResponse.json({ ok: true, idempotent: true });
      }
      return NextResponse.json({ error: "INVALID_STATE_TRANSITION" }, { status: 400 });
    }

    if (nextStatus === "approved") {
      const { runAlumniOnboardingActivation } = await import(
        "@/lib/alumni/account-activation/activation-service"
      );
      const activated = await runAlumniOnboardingActivation({ requestDoc: row });
      if (!activated.ok) {
        return NextResponse.json({ error: activated.code }, { status: 500 });
      }
    }

    row.status = nextStatus;
    row.reviewedById = new mongoose.Types.ObjectId(String(gate.user._id));
    row.reviewedAt = new Date();
    row.reviewNotes = reviewNotes || undefined;
    await row.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/onboarding-requests]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
