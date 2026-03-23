import { NextRequest, NextResponse } from "next/server";
import { buildHallOfFameStudents } from "@/lib/hall-of-fame-service";
import type { HallTier } from "@/lib/hall-of-fame-level";

export const dynamic = "force-dynamic";

const TIER_SET = new Set<string>([
  "all",
  "international",
  "national",
  "regional",
  "school",
  "participation",
]);

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const locale = sp.get("locale") === "en" ? "en" : "ar";
    const minTierRaw = sp.get("minTier") || "all";
    const minTier = (TIER_SET.has(minTierRaw) ? minTierRaw : "all") as "all" | HallTier;

    const result = await buildHallOfFameStudents({
      locale,
      academicYear: sp.get("year") || undefined,
      gender: (sp.get("gender") as "all" | "male" | "female") || "all",
      stage: (sp.get("stage") as "all" | "primary" | "middle" | "secondary") || "all",
      grade: sp.get("grade") || undefined,
      minTier,
      search: sp.get("q") || undefined,
      page: Math.max(1, parseInt(sp.get("page") || "1", 10) || 1),
      pageSize: Math.min(48, Math.max(6, parseInt(sp.get("pageSize") || "24", 10) || 24)),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET hall-of-fame]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
