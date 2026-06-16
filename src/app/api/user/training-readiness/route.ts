import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildGraduateReadinessWidget } from "@/lib/partnerships/training-portfolio-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user?._id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(user.role || "").trim();
    if (role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const widget = await buildGraduateReadinessWidget(String(user._id));
    return NextResponse.json({ ok: true, item: widget });
  } catch (error) {
    console.error("[GET /api/user/training-readiness]", error);
    return jsonInternalServerError(error);
  }
}
