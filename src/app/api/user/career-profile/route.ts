import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  buildStudentCareerProfile,
  updateStudentCareerProfile,
} from "@/lib/career/student-career-profile-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (String(user.role) !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lang = request.nextUrl.searchParams.get("lang");
    const locale = lang === "en" ? "en" : "ar";
    const item = await buildStudentCareerProfile(String(user._id), { locale });
    if (!item) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("[GET /api/user/career-profile]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (String(user.role) !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const item = await updateStudentCareerProfile(String(user._id), {
      professionalBio: body.professionalBio != null ? String(body.professionalBio) : undefined,
      professionalBioEn: body.professionalBioEn != null ? String(body.professionalBioEn) : undefined,
      careerInterests: Array.isArray(body.careerInterests)
        ? body.careerInterests.map((v) => String(v))
        : undefined,
      targetMajors: Array.isArray(body.targetMajors) ? body.targetMajors.map((v) => String(v)) : undefined,
      manualSkills: Array.isArray(body.manualSkills) ? body.manualSkills.map((v) => String(v)) : undefined,
      publicVisibility:
        body.publicVisibility && typeof body.publicVisibility === "object"
          ? (body.publicVisibility as Record<string, boolean>)
          : undefined,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("[PATCH /api/user/career-profile]", error);
    return jsonInternalServerError(error);
  }
}
