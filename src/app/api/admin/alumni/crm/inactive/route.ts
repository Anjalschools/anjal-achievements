import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const inactiveDays = Math.min(365, Math.max(30, Number(request.nextUrl.searchParams.get("days")) || 120));
    const limit = Math.min(80, Math.max(5, Number(request.nextUrl.searchParams.get("limit")) || 40));
    const cutoff = new Date(Date.now() - inactiveDays * 86_400_000);

    await connectDB();
    const rows = await User.find({
      accountType: "alumni",
      $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }, { lastLoginAt: { $lt: cutoff } }],
    })
      .select("fullName email alumniProfile.universityName lastLoginAt")
      .sort({ lastLoginAt: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      ok: true,
      inactiveDays,
      items: rows.map((u: any) => ({
        id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        universityName: u.alumniProfile?.universityName ?? null,
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/crm/inactive]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
