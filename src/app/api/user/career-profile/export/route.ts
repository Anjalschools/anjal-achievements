import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildCareerProfilePdfHtml, type CareerPdfKind } from "@/lib/career/career-profile-pdf-layout";
import { buildStudentCareerProfile } from "@/lib/career/student-career-profile-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const KINDS = new Set<CareerPdfKind>(["resume", "career_portfolio", "university_portfolio"]);

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (String(user.role) !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const kind = String(searchParams.get("kind") || "resume").trim() as CareerPdfKind;
    const locale = searchParams.get("lang") === "en" ? "en" : "ar";

    if (!KINDS.has(kind)) {
      return NextResponse.json({ error: "Invalid export kind" }, { status: 400 });
    }

    const payload = await buildStudentCareerProfile(String(user._id), { locale, refreshScores: false });
    if (!payload) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const html = buildCareerProfilePdfHtml(payload, kind, locale);
    const filename = `career-${kind}-${new Date().toISOString().slice(0, 10)}.html`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/user/career-profile/export]", error);
    return jsonInternalServerError(error);
  }
}
