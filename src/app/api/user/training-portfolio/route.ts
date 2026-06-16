import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildStudentTrainingPortfolio } from "@/lib/partnerships/training-portfolio-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user?._id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(user.role || "").trim();
    if (role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const locale = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "ar";
    const portfolio = await buildStudentTrainingPortfolio(String(user._id), locale);
    if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, item: portfolio });
  } catch (error) {
    console.error("[GET /api/user/training-portfolio]", error);
    return jsonInternalServerError(error);
  }
}
