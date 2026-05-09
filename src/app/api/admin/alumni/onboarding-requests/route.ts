import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import User, { type AlumniProfile } from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";
import type {
  AlumniOnboardingAdminListItem,
  AlumniOnboardingStatus,
} from "@/lib/alumni/onboarding-types";

export const dynamic = "force-dynamic";

const isValidStatus = (value: unknown): value is AlumniOnboardingStatus =>
  value === "pending" || value === "approved" || value === "rejected";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    const q = sanitizeUserText(String(sp.get("q") || ""));
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (isValidStatus(statusParam)) filter.status = statusParam;
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

    const [items, total, pendingCount] = await Promise.all([
      AlumniOnboardingRequest.find(filter)
        .select(
          "userId fullName email phone graduationYear universityName major degree customDegree studyCountry currentCompany currentPosition industry linkedinUrl city country bio services status reviewedById reviewedAt reviewNotes createdAt updatedAt"
        )
        .sort({ createdAt: -1 })
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

    row.status = nextStatus;
    row.reviewedById = new mongoose.Types.ObjectId(String(gate.user._id));
    row.reviewedAt = new Date();
    row.reviewNotes = reviewNotes || undefined;
    await row.save();

    if (nextStatus === "approved" && row.userId && mongoose.Types.ObjectId.isValid(String(row.userId))) {
      const user = await User.findById(row.userId);
      if (user) {
        user.accountType = "alumni";
        const prevProfile = user.alumniProfile || {};
        const reqDeg = row.degree ? String(row.degree).trim() : "";
        const reqCustom = row.customDegree ? String(row.customDegree).trim() : "";
        const resolvedDegree =
          reqDeg === "أخرى" ? reqCustom || prevProfile.degree || reqDeg : reqDeg || prevProfile.degree;

        user.alumniProfile = {
          graduationYear: row.graduationYear ?? prevProfile.graduationYear,
          universityName: row.universityName || prevProfile.universityName,
          major: row.major || prevProfile.major,
          degree: resolvedDegree || prevProfile.degree,
          studyCountry: row.studyCountry || prevProfile.studyCountry,
          currentCompany: row.currentCompany || prevProfile.currentCompany,
          currentPosition: row.currentPosition || prevProfile.currentPosition,
          industry: row.industry || prevProfile.industry,
          linkedinUrl: row.linkedinUrl || prevProfile.linkedinUrl,
          city: row.city || prevProfile.city,
          country: row.country || prevProfile.country,
          bio: row.bio || prevProfile.bio,
          isFeaturedAlumni: prevProfile.isFeaturedAlumni,
          isVerifiedAlumni: prevProfile.isVerifiedAlumni,
          alumniServices: {
            mentoring: row.services?.mentoring ?? prevProfile.alumniServices?.mentoring,
            internships: row.services?.internships ?? prevProfile.alumniServices?.internships,
            jobs: row.services?.jobs ?? prevProfile.alumniServices?.jobs,
            workshops: row.services?.workshops ?? prevProfile.alumniServices?.workshops,
            judging: row.services?.judging ?? prevProfile.alumniServices?.judging,
            sponsorship: row.services?.sponsorship ?? prevProfile.alumniServices?.sponsorship,
          },
        } satisfies AlumniProfile;
        await user.save();

        const emailTo = String(user.email || "").trim().toLowerCase();
        if (emailTo.includes("@")) {
          try {
            const { sendAlumniApprovalEmail } = await import("@/lib/alumni/send-alumni-approval-email");
            const sent = await sendAlumniApprovalEmail({
              to: emailTo,
              recipientName: String(user.fullNameAr || user.fullName || row.fullName || ""),
              useExistingPortalPassword: user.role === "student",
              services: row.services || undefined,
            });
            if (!sent) {
              console.warn("[alumni onboarding] approval email not sent (SMTP off or failed)", {
                userId: String(row.userId),
              });
            }
          } catch (e) {
            console.warn("[alumni onboarding] approval email error", e);
          }
        }

        try {
          const { canSendSystemNotification } = await import("@/lib/alumni/consent");
          const { createStudentNotification } = await import("@/lib/student-notifications");
          const uid = user._id as mongoose.Types.ObjectId;
          if (await canSendSystemNotification(uid)) {
            await createStudentNotification({
              userId: uid,
              type: "system",
              title: "تم اعتماد حسابك ضمن مجتمع خريجي الأنجال",
              message:
                "يمكنك الآن تسجيل الدخول والاستفادة من خدمات مجتمع الخريجين. راجع بريدك الإلكتروني للتفاصيل وروابط الدخول.",
              metadata: { alumniOnboardingApproved: true },
            });
          }
        } catch (e) {
          console.warn("[alumni onboarding] approval notification skipped", e);
        }

        const { enqueueAutomationJob } = await import("@/lib/alumni/automation/lifecycle-engine");
        await enqueueAutomationJob({
          type: "alumni.welcome",
          payload: { userId: String(row.userId) },
          correlationId: `alumni-welcome-${row.userId}`,
        });
      }
    }

    if (nextStatus === "approved" && !row.userId) {
      // TODO: Future phase — send invitation email to create/link an account for approved public requests.
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/admin/alumni/onboarding-requests]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
