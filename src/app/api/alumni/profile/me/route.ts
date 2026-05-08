import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { getCurrentDbUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getCurrentDbUser();
    if (!currentUser?._id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    await connectDB();
    const row = await User.findById(currentUser._id)
      .select("fullName accountType alumniProfile profilePhoto createdAt")
      .lean();

    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      item: {
        id: (row as any)._id.toString(),
        fullName: (row as any).fullName || "",
        accountType: (row as any).accountType || "student",
        profilePhoto: (row as any).profilePhoto || null,
        alumniProfile: (row as any).alumniProfile || {},
        createdAt: (row as any).createdAt ? new Date((row as any).createdAt).toISOString() : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/alumni/profile/me]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
