import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const limit = Math.min(60, Math.max(5, Number(request.nextUrl.searchParams.get("limit")) || 24));
    await connectDB();

    const rows = await User.find({ accountType: "alumni" })
      .select("fullName email alumniProfile.universityName alumniProfile.reputationScore alumniProfile.industry")
      .sort({ "alumniProfile.reputationScore": -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      items: rows.map((u: any) => ({
        id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        universityName: u.alumniProfile?.universityName ?? null,
        industry: u.alumniProfile?.industry ?? null,
        reputationScore: u.alumniProfile?.reputationScore ?? 0,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/crm/top-engaged]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
