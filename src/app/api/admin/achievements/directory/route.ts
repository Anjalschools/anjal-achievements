import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { buildAchievementAccessFilter, mergeWithAchievementScope } from "@/lib/achievement-scope-filter";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

const safe = (v: string | null): string => String(v || "").trim();

const parseBool = (v: string | null): boolean | null => {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
};

const parseIntSafe = (v: string | null, fallback: number): number => {
  const n = parseInt(String(v || ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

const sortSpecFromParam = (sort: string): Record<string, 1 | -1> => {
  if (sort === "oldest") return { createdAt: 1 };
  if (sort === "updated_desc") return { updatedAt: -1, createdAt: -1 };
  if (sort === "year_desc") return { achievementYear: -1, createdAt: -1 };
  if (sort === "year_asc") return { achievementYear: 1, createdAt: -1 };
  if (sort === "status_asc") return { status: 1, createdAt: -1 };
  if (sort === "student_asc") return { createdAt: -1 };
  if (sort === "achievement_asc") return { createdAt: -1 };
  return { createdAt: -1 };
};

const entryTypeFilter = (v: string): Record<string, unknown> | null => {
  if (v === "student_registered") return { studentSourceType: "registered" };
  if (v === "admin_manual") return { studentSourceType: "manual" };
  if (v === "external_graduate") return { studentSourceType: "external" };
  if (v === "linked_account") return { studentSourceType: "linked" };
  return null;
};

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const scopeFilter = await buildAchievementAccessFilter(gate.user);
    const sp = request.nextUrl.searchParams;

    const q = safe(sp.get("q"));
    const status = safe(sp.get("status"));
    const type = safe(sp.get("type"));
    const field = safe(sp.get("field"));
    const level = safe(sp.get("level"));
    const gender = safe(sp.get("gender"));
    const grade = safe(sp.get("grade"));
    const section = safe(sp.get("section"));
    const mawhiba = safe(sp.get("mawhiba"));
    const entryType = safe(sp.get("entryType"));
    const year = safe(sp.get("year"));
    const featured = parseBool(sp.get("featured"));
    const approved = parseBool(sp.get("approved"));
    const sort = safe(sp.get("sort")) || "newest";
    const page = Math.max(1, parseIntSafe(sp.get("page"), 1));
    const limit = Math.min(100, Math.max(1, parseIntSafe(sp.get("limit"), 20)));
    const skip = (page - 1) * limit;

    const andParts: Record<string, unknown>[] = [];
    if (status && status !== "all") andParts.push({ status });
    if (type && type !== "all") andParts.push({ achievementType: type });
    if (field && field !== "all") andParts.push({ inferredField: field });
    if (level && level !== "all") andParts.push({ achievementLevel: level });
    if (year && year !== "all") andParts.push({ achievementYear: parseIntSafe(year, 0) });
    if (featured !== null) andParts.push({ $or: [{ isFeatured: featured }, { featured }] });
    if (approved !== null) andParts.push({ approved });
    const et = entryTypeFilter(entryType);
    if (et) andParts.push(et);

    const userFilterParts: Record<string, unknown>[] = [];
    if (gender && gender !== "all") userFilterParts.push({ gender });
    if (grade && grade !== "all") userFilterParts.push({ grade });
    if (section && section !== "all") userFilterParts.push({ section });
    if (mawhiba === "yes") userFilterParts.push({ isMawhibaStudent: true });
    if (mawhiba === "no") userFilterParts.push({ isMawhibaStudent: { $ne: true } });

    let userIdsFromFilter: unknown[] | null = null;
    if (userFilterParts.length > 0) {
      const uf =
        userFilterParts.length === 1 ? userFilterParts[0] : { $and: userFilterParts };
      const users = await User.find(uf).select("_id").lean();
      userIdsFromFilter = users.map((u) => u._id);
      if (userIdsFromFilter.length === 0) {
        return NextResponse.json({
          items: [],
          total: 0,
          page,
          limit,
          hasMore: false,
        });
      }
      andParts.push({ userId: { $in: userIdsFromFilter } });
    }

    if (q) {
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(esc, "i");
      const matchedUsers = await User.find({
        $or: [{ fullName: rx }, { username: rx }, { studentId: rx }, { email: rx }],
      })
        .select("_id")
        .limit(300)
        .lean();
      const userIdsFromSearch = matchedUsers.map((u) => u._id);
      andParts.push({
        $or: [
          { nameAr: rx },
          { nameEn: rx },
          { title: rx },
          { achievementName: rx },
          { customAchievementName: rx },
          { achievementType: rx },
          { achievementCategory: rx },
          { inferredField: rx },
          { competitionName: rx },
          { programName: rx },
          { exhibitionName: rx },
          ...(userIdsFromSearch.length > 0 ? [{ userId: { $in: userIdsFromSearch } }] : []),
        ],
      });
    }

    const baseFilter =
      andParts.length === 0 ? {} : andParts.length === 1 ? andParts[0] : { $and: andParts };
    const mongoFilter = mergeWithAchievementScope(baseFilter, scopeFilter);

    const total = await Achievement.countDocuments(mongoFilter);
    const rows = await Achievement.find(mongoFilter)
      .sort(sortSpecFromParam(sort))
      .skip(skip)
      .limit(limit)
      .lean();

    const populatedRows = await Achievement.populate(rows, {
      path: "userId",
      select: "fullName username studentId gender grade section isMawhibaStudent",
    });

    const textSort = sort === "student_asc" || sort === "achievement_asc";

    const items = populatedRows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const user = (r.userId || null) as
        | {
            fullName?: string;
            username?: string;
            studentId?: string;
            gender?: string;
            grade?: string;
            section?: string;
          }
        | null;

      const title =
        String(r.nameAr || "").trim() ||
        String(r.nameEn || "").trim() ||
        String(r.achievementName || "").trim() ||
        String(r.title || "").trim() ||
        "Achievement";

      return {
        id: String(r._id || ""),
        title,
        nameAr: String(r.nameAr || "").trim(),
        nameEn: String(r.nameEn || "").trim(),
        achievementName: String(r.achievementName || "").trim(),
        customAchievementName: String(r.customAchievementName || "").trim(),
        achievementType: String(r.achievementType || "").trim(),
        achievementCategory: String(r.achievementCategory || "").trim(),
        inferredField: String(r.inferredField || r.domain || "").trim(),
        achievementLevel: String(r.achievementLevel || r.level || "").trim(),
        participationType: String(r.participationType || "").trim(),
        resultType: String(r.resultType || "").trim(),
        medalType: String(r.medalType || "").trim(),
        rank: String(r.rank || "").trim(),
        score: typeof r.score === "number" ? r.score : null,
        achievementYear:
          typeof r.achievementYear === "number" ? r.achievementYear : null,
        status: String(r.status || (r.approved === true ? "approved" : "pending")),
        isFeatured: r.isFeatured === true || r.featured === true,
        approved: r.approved === true,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ""),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt || ""),
        date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date || ""),
        studentSourceType: String(r.studentSourceType || "").trim(),
        student: {
          fullName: user?.fullName || "",
          username: user?.username || "",
          studentId: user?.studentId || "",
          gender: user?.gender || "",
          grade: user?.grade || "",
          section: user?.section || "",
        },
      };
    });

    if (textSort) {
      items.sort((a, b) => {
        if (sort === "student_asc") {
          return String(a.student.fullName || "").localeCompare(String(b.student.fullName || ""), "ar");
        }
        return String(a.title || "").localeCompare(String(b.title || ""), "ar");
      });
    }

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (e) {
    console.error("[GET /api/admin/achievements/directory]", e);
    return jsonInternalServerError(e);
  }
}

