import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { getAccountType } from "@/lib/account-type";
import { redactAlumniProfileForPublic } from "@/lib/alumni/privacy";

type RouteParams = { params: { id: string } };

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const id = String(params.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    await connectDB();
    const row = await User.findById(id)
      .select("fullName accountType alumniProfile profilePhoto createdAt")
      .lean();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const accountType = getAccountType(row as any);
    if (accountType !== "alumni") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const ap = (row as any).alumniProfile;
    const safe = redactAlumniProfileForPublic(ap);
    if (safe === null) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      item: {
        id: (row as any)._id.toString(),
        fullName: (row as any).fullName || "",
        accountType,
        profilePhoto: (row as any).profilePhoto || null,
        alumniProfile: safe,
        createdAt: (row as any).createdAt ? new Date((row as any).createdAt).toISOString() : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-profile/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
