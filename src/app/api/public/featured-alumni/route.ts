import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { blockIneligibleStudentOnPublicCommunityApi } from "@/lib/alumni/public-community-session-guard";
import {
  getFeaturedAlumniCached,
  setFeaturedAlumniCached,
} from "@/lib/alumni/alumni-public-cache";
import type { FeaturedAlumniResponse } from "@/lib/alumni/alumni-public-types";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const CACHE_TTL_MS = 45_000;

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
  },
};

const EMPTY_RESPONSE: FeaturedAlumniResponse = {
  ok: true,
  items: [],
};

type FeaturedAlumniDoc = {
  _id: { toString(): string };
  fullName?: string;
  profilePhoto?: string;
  alumniProfile?: {
    graduationYear?: number;
    universityName?: string;
    currentPosition?: string;
    currentCompany?: string;
    bio?: string;
    isVerifiedAlumni?: boolean;
    verificationTier?: string;
    trustScore?: number;
  };
};

export async function GET() {
  try {
    const blocked = await blockIneligibleStudentOnPublicCommunityApi();
    if (blocked) return blocked;
    const hit = getFeaturedAlumniCached();
    if (hit) {
      return NextResponse.json(hit, JSON_HEADERS);
    }

    await connectDB();

    const rows = await User.find(
      { "alumniProfile.isFeaturedAlumni": true },
      {
        fullName: 1,
        profilePhoto: 1,
        "alumniProfile.graduationYear": 1,
        "alumniProfile.universityName": 1,
        "alumniProfile.currentPosition": 1,
        "alumniProfile.currentCompany": 1,
        "alumniProfile.bio": 1,
        "alumniProfile.isVerifiedAlumni": 1,
        "alumniProfile.verificationTier": 1,
        "alumniProfile.trustScore": 1,
      }
    )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(12)
      .lean<FeaturedAlumniDoc[]>();

    const body: FeaturedAlumniResponse = {
      ok: true,
      items: rows.map((row) => ({
        id: row._id.toString(),
        fullName: row.fullName || "Alumni",
        graduationYear: row.alumniProfile?.graduationYear ?? null,
        universityName: row.alumniProfile?.universityName ?? null,
        currentPosition: row.alumniProfile?.currentPosition ?? null,
        currentCompany: row.alumniProfile?.currentCompany ?? null,
        bio: row.alumniProfile?.bio ?? null,
        avatar: row.profilePhoto ?? null,
        isVerifiedAlumni: row.alumniProfile?.isVerifiedAlumni === true,
        verificationTier:
          row.alumniProfile?.verificationTier === "basic" ||
          row.alumniProfile?.verificationTier === "academic" ||
          row.alumniProfile?.verificationTier === "career" ||
          row.alumniProfile?.verificationTier === "institution" ||
          row.alumniProfile?.verificationTier === "global"
            ? row.alumniProfile.verificationTier
            : undefined,
        trustScore:
          typeof row.alumniProfile?.trustScore === "number" ? row.alumniProfile.trustScore : null,
      })),
    };

    setFeaturedAlumniCached(body, CACHE_TTL_MS);
    return NextResponse.json(body, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/featured-alumni]", error);
    return NextResponse.json(EMPTY_RESPONSE, JSON_HEADERS);
  }
}
