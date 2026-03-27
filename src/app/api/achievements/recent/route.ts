import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import Achievement from "@/models/Achievement";
import { resolveWorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import { achievementOwnerUserIdFilter } from "@/lib/achievement-student-scope";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "5", 10) || 5)
    );

    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const query = achievementOwnerUserIdFilter(user._id);

    const achievements = await Achievement.find(query)
      .populate("userId", "fullName")
      .sort({ createdAt: -1 })
      .limit(limit);

    const formatted = achievements.map((achievement: any) => {
      // Safe date resolution: date → createdAt → achievementYear → null
      const safeDate =
        achievement.date instanceof Date && !isNaN(achievement.date.getTime())
          ? achievement.date
          : achievement.createdAt instanceof Date && !isNaN(achievement.createdAt.getTime())
            ? achievement.createdAt
            : achievement.achievementYear && typeof achievement.achievementYear === "number"
              ? new Date(`${achievement.achievementYear}-01-01`)
              : null;

      // Safe title resolution: title → achievementName → "Achievement"
      const safeTitle =
        achievement.title && typeof achievement.title === "string" && achievement.title.trim()
          ? achievement.title.trim()
          : achievement.achievementName && typeof achievement.achievementName === "string" && achievement.achievementName.trim()
            ? achievement.achievementName.trim()
            : achievement.customAchievementName && typeof achievement.customAchievementName === "string" && achievement.customAchievementName.trim()
              ? achievement.customAchievementName.trim()
              : "Achievement";

      return {
        id: achievement._id.toString(),
        title: safeTitle,
        nameAr: achievement.nameAr || "",
        nameEn: achievement.nameEn || "",
        date: safeDate ? safeDate.toISOString().split("T")[0] : "",
        type: achievement.achievementType || "achievement",
        achievementCategory: achievement.achievementCategory || "",
        inferredField: achievement.inferredField || achievement.domain || "",
        verificationStatus: achievement.verificationStatus || "unverified",
        requiresCommitteeReview: achievement.requiresCommitteeReview || false,
        featured: achievement.featured || false,
        approvalStatus:
          (achievement as any).approvalStatus ||
          resolveWorkflowDisplayStatus({
            status: (achievement as any).status,
            isFeatured: (achievement as any).isFeatured,
            featured: achievement.featured,
            approved: achievement.approved,
            verificationStatus: achievement.verificationStatus,
            pendingReReview: (achievement as any).pendingReReview === true,
          }),
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching recent achievements:", error);
    return jsonInternalServerError(error);
  }
}
