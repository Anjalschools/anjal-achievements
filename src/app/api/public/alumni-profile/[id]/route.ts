import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Achievement from "@/models/Achievement";
import AlumniMentorshipRequest from "@/models/AlumniMentorshipRequest";
import { computeAlumniBadges } from "@/lib/alumni/compute-alumni-badges";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";
import { getAccountType } from "@/lib/account-type";
import { redactAlumniProfileForPublic } from "@/lib/alumni/privacy";
import { normalizeStudentPortfolioContentFromDoc } from "@/lib/student-portfolio-content";

type RouteParams = { params: { id: string } };

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const blocked = await blockIneligibleStudentOnPublicCommunityApi();
    if (blocked) return blocked;
    const id = String(params.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
    }
    await connectDB();
    const row = await User.findById(id)
      .select(
        "fullName accountType alumniProfile profilePhoto createdAt lastLoginAt updatedAt completedAlumniOnboardingAt studentPortfolioContent"
      )
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

    const uid = (row as any)._id as mongoose.Types.ObjectId;
    const postsRaw = Array.isArray((ap as any)?.memoryPosts) ? (ap as any).memoryPosts : [];
    const approvedMem = postsRaw.filter((p: { status?: string }) => p && p.status === "approved");
    const scoredMem = approvedMem.map((p: Record<string, unknown>) => {
      const likes = typeof p.likeCount === "number" ? p.likeCount : 0;
      const views = typeof p.viewCount === "number" ? p.viewCount : 0;
      const score = likes * 3 + views;
      return { p, score };
    });
    scoredMem.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    const top = scoredMem[0]?.p as
      | { _id?: mongoose.Types.ObjectId; imageUrl?: string; caption?: string }
      | undefined;
    const featuredMemory = top?.imageUrl
      ? {
          memoryPostId: top._id ? String(top._id) : "",
          imageUrl: String(top.imageUrl),
          caption: top.caption ? String(top.caption) : "",
        }
      : null;

    const [certificateCount, mentorshipParticipationCount] = await Promise.all([
      Achievement.countDocuments({
        userId: uid,
        approved: true,
        certificateIssuedAt: { $exists: true, $ne: null },
      }),
      AlumniMentorshipRequest.countDocuments({
        requesterId: uid,
        status: { $in: ["pending", "accepted", "completed"] },
      }),
    ]);

    const spc = normalizeStudentPortfolioContentFromDoc((row as any).studentPortfolioContent);

    const alumniTrustBadges = computeAlumniBadges(
      {
        createdAt: (row as any).createdAt,
        profilePhoto: (row as any).profilePhoto,
        lastLoginAt: (row as any).lastLoginAt,
        updatedAt: (row as any).updatedAt,
        completedAlumniOnboardingAt: (row as any).completedAlumniOnboardingAt,
        accountType: "alumni",
        alumniProfile: {
          ...(typeof ap === "object" && ap ? (ap as Record<string, unknown>) : {}),
          memoryPosts: postsRaw,
          badges: Array.isArray((ap as any)?.badges) ? (ap as any).badges : undefined,
        },
        studentPortfolioContent: spc || undefined,
      },
      { certificateCount, mentorshipParticipationCount }
    );

    const topExpertise = [
      (safe as { major?: string }).major,
      (safe as { industry?: string }).industry,
      ...(((safe as { interests?: string[] }).interests) || []),
    ]
      .map((x) => (x != null ? String(x).trim() : ""))
      .filter(Boolean);
    const topExpertiseUnique = [...new Set(topExpertise)].slice(0, 5);

    return NextResponse.json({
      ok: true,
      item: {
        id: uid.toString(),
        fullName: (row as any).fullName || "",
        accountType,
        profilePhoto: (row as any).profilePhoto || null,
        alumniProfile: safe,
        createdAt: (row as any).createdAt ? new Date((row as any).createdAt).toISOString() : null,
        alumniTrustBadges,
        featuredMemory,
        topExpertise: topExpertiseUnique,
        professionalSummary:
          typeof (safe as { bio?: string }).bio === "string"
            ? String((safe as { bio?: string }).bio).trim() || null
            : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/public/alumni-profile/[id]]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
