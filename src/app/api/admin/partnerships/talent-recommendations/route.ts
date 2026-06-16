import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import InstitutionTalentRecommendation from "@/models/InstitutionTalentRecommendation";
import PartnerOrganization from "@/models/PartnerOrganization";
import User from "@/models/User";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { resolveInstitutionOrganizationForUser } from "@/lib/partnerships/institution-portal-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const canViewRecommendations = async (): Promise<
  | { ok: true; scope: "admin" | "supervisor" | "institution" | "student"; institutionId?: string; studentId?: string }
  | { ok: false; response: NextResponse }
> => {
  const user = await getCurrentDbUser();
  if (!user?._id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = String(user.role || "").trim();

  if (role === "admin" || role === "partnershipSupervisor") {
    const gate = await requirePartnershipsView();
    if (!gate.ok) return { ok: false, response: gate.response };
    return { ok: true, scope: role === "admin" ? "admin" : "supervisor" };
  }

  if (role === "student") {
    return { ok: true, scope: "student", studentId: String(user._id) };
  }

  const org = await resolveInstitutionOrganizationForUser(String(user._id));
  if (org?.id) {
    return { ok: true, scope: "institution", institutionId: org.id };
  }

  return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
};

export async function GET(request: NextRequest) {
  try {
    const access = await canViewRecommendations();
    if (!access.ok) return access.response;

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (access.scope === "student" && access.studentId) {
      filter.studentId = access.studentId;
    } else if (access.scope === "institution" && access.institutionId) {
      filter.institutionId = access.institutionId;
    }

    const studentIdParam = request.nextUrl.searchParams.get("studentId")?.trim();
    if ((access.scope === "admin" || access.scope === "supervisor") && studentIdParam) {
      filter.studentId = studentIdParam;
    }

    const rows = await InstitutionTalentRecommendation.find(filter)
      .sort({ recommendationDate: -1 })
      .limit(200)
      .lean();

    const institutionIds = [...new Set(rows.map((r) => String(r.institutionId)))];
    const studentIds = [...new Set(rows.map((r) => String(r.studentId)))];

    const [institutions, students] = await Promise.all([
      institutionIds.length
        ? PartnerOrganization.find({ _id: { $in: institutionIds } }).select("name").lean()
        : [],
      studentIds.length ? User.find({ _id: { $in: studentIds } }).select("fullName fullNameAr").lean() : [],
    ]);

    const institutionMap = new Map(institutions.map((i) => [String(i._id), String(i.name || "")]));
    const studentMap = new Map(students.map((s) => [String(s._id), String(s.fullNameAr || s.fullName || "")]));

    const items = rows.map((r) => ({
      id: String(r._id),
      studentId: String(r.studentId),
      studentName: studentMap.get(String(r.studentId)) || "",
      institutionId: String(r.institutionId),
      institutionName: institutionMap.get(String(r.institutionId)) || "",
      applicationId: String(r.applicationId),
      recommendationDate: new Date(r.recommendationDate).toISOString(),
      recommendationLevel: r.recommendationLevel,
      supervisorComment: r.supervisorComment || null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/talent-recommendations]", error);
    return jsonInternalServerError(error);
  }
}
