import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { requireAchievementReviewer } from "@/lib/review-auth";
import {
  buildLegacyBackfillPreview,
  CLASSIFIER_VERSION,
  type LegacyAchievementInput,
} from "@/lib/achievement-legacy-classification";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

const BACKFILL_CANDIDATE_QUERY = {
  achievementType: { $in: ["program", "other"] },
  achievementCategory: {
    $nin: [
      "early_university_admission",
      "entrepreneurship",
      "training_courses",
      "standardized_tests",
    ],
  },
};

const rowToLegacyInput = (row: Record<string, unknown>): LegacyAchievementInput => ({
  achievementType: String(row.achievementType || ""),
  achievementCategory: String(row.achievementCategory || ""),
  achievementName: String(row.achievementName || ""),
  title: String(row.title || ""),
  nameAr: String(row.nameAr || ""),
  nameEn: String(row.nameEn || ""),
  customAchievementName: String(row.customAchievementName || ""),
  description: String(row.description || ""),
  organization: String(row.organization || ""),
  achievementLevel: String(row.achievementLevel || ""),
  participationType: String(row.participationType || ""),
  resultType: String(row.resultType || ""),
  resultValue: String(row.resultValue || ""),
  nominationText: String(row.nominationText || ""),
  inferredField: String(row.inferredField || ""),
  evidenceUrl: String(row.evidenceUrl || ""),
  evidenceFileName: String(row.evidenceFileName || ""),
  aiSummary: String(row.aiSummary || ""),
  status: String(row.status || ""),
  approved: row.approved === true,
  featured: row.featured === true,
  isFeatured: row.isFeatured === true,
  showInHallOfFame: row.showInHallOfFame !== false,
  lastEditedByRole: String(row.lastEditedByRole || ""),
  evidenceExtractedData:
    row.evidenceExtractedData && typeof row.evidenceExtractedData === "object"
      ? (row.evidenceExtractedData as Record<string, unknown>)
      : null,
});

/**
 * GET /api/admin/achievement-backfill-preview?limit=50&onlyWouldApply=1
 * Read-only: proposed category backfill (no DB writes).
 */
export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50)
    );
    const onlyWouldApply = searchParams.get("onlyWouldApply") === "1";

    await connectDB();

    const totalCandidates = await Achievement.countDocuments(BACKFILL_CANDIDATE_QUERY);

    const rows = await Achievement.find(BACKFILL_CANDIDATE_QUERY)
      .select(
        "_id achievementType achievementCategory achievementName title nameAr nameEn customAchievementName description organization achievementLevel participationType resultType resultValue nominationText inferredField evidenceUrl evidenceFileName evidenceExtractedData aiSummary status approved featured isFeatured showInHallOfFame lastEditedByRole"
      )
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    const previews = rows
      .map((doc) => {
        const row = doc as unknown as Record<string, unknown>;
        const input = rowToLegacyInput(row);
        const preview = buildLegacyBackfillPreview(input);
        return {
          id: String(row._id),
          studentId: String(row.userId || ""),
          ...preview,
          classification: preview.classification
            ? {
                category: preview.classification.category,
                confidence: preview.classification.confidence,
                score: preview.classification.score,
                reasons: preview.classification.reasons,
                matchedSignals: preview.classification.matchedSignals,
                negativeSignals: preview.classification.negativeSignals,
              }
            : null,
        };
      })
      .filter((p) => (onlyWouldApply ? p.wouldApply : true));

    const wouldApplyCount = previews.filter((p) => p.wouldApply).length;

    return NextResponse.json({
      readOnly: true,
      classifierVersion: CLASSIFIER_VERSION,
      totalCandidates,
      scanned: rows.length,
      returned: previews.length,
      wouldApplyCount,
      safetyRecommendation: [
        "npm run backfill:achievement-categories -- --dry-run --limit=50 --verbose",
        "npm run backfill:achievement-categories -- --dry-run --limit=500",
        "npm run backfill:achievement-categories -- --apply --batch=50",
      ],
      previews,
    });
  } catch (e) {
    console.error("[achievement-backfill-preview]", e);
    return jsonInternalServerError(e);
  }
}
