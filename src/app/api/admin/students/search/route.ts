import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  const q = String(request.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: true, items: [] });
  }

  try {
    await connectDB();
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(esc, "i");
    const users = await User.find({
      role: "student",
      status: "active",
      $or: [{ fullName: rx }, { fullNameAr: rx }, { email: rx }, { username: rx }, { studentId: rx }],
    })
      .select("fullName fullNameAr fullNameEn profilePhoto grade gender section studentId username")
      .limit(20)
      .lean();

    const items = users.map((u) => {
      const x = u as unknown as Record<string, unknown>;
      return {
        id: String(x._id),
        fullName: String(x.fullNameAr || x.fullName || x.fullNameEn || ""),
        fullNameEn: String(x.fullNameEn || ""),
        grade: String(x.grade || ""),
        section: String(x.section || ""),
        studentId: String(x.studentId || ""),
        username: String(x.username || ""),
        gender: x.gender === "female" ? "female" : "male",
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[GET /api/admin/students/search]", e);
    return jsonInternalServerError(e);
  }
}
