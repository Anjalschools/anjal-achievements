import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { publicFeaturedAchievementsFilter } from "@/lib/achievementWorkflow";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

/**
 * Public (no auth): approved + platform-featured achievements for landing / showcases.
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const limit = Math.min(12, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "8", 10) || 8));

    const achievements = await Achievement.find(publicFeaturedAchievementsFilter())
      .sort({ featuredAt: -1, createdAt: -1 })
      .limit(limit)
      .populate("userId", "fullName")
      .lean();

    const items = achievements.map((doc) => {
      const a = doc as unknown as Record<string, unknown>;
      const user = a.userId as { fullName?: string } | null;
      const title =
        (a.nameAr as string) ||
        (a.nameEn as string) ||
        (a.achievementName as string) ||
        (a.title as string) ||
        "Achievement";
      const safeDate =
        a.date instanceof Date
          ? a.date
          : a.createdAt instanceof Date
            ? a.createdAt
            : a.achievementYear
              ? new Date(`${a.achievementYear}-01-01`)
              : null;
      const img = a.image;
      const imageOut =
        typeof img === "string" && img.trim() ? img : null;

      return {
        id: String(a._id),
        title,
        studentName: user?.fullName || "",
        achievementType: a.achievementType as string | undefined,
        achievementLevel: (a.achievementLevel || a.level) as string | undefined,
        inferredField: (a.inferredField || a.domain) as string | undefined,
        image: imageOut,
        date: safeDate ? safeDate.toISOString().split("T")[0] : "",
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET public-featured]", e);
    return jsonInternalServerError(e);
  }
}
