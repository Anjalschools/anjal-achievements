import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { hallOfFameApprovedAchievementFilter } from "@/lib/hall-of-fame-approved";

/** Approved achievements for admin ranking (not restricted by Hall of Fame visibility). */
export const adminApprovedAchievementFilter = (): Record<string, unknown> => ({
  $and: [
    {
      $or: [{ pendingReReview: { $ne: true } }, { pendingReReview: { $exists: false } }],
    },
    {
      $or: [
        { status: "approved" },
        {
          $and: [
            { approved: true },
            {
              $or: [{ status: { $exists: false } }, { status: null }, { status: "" }],
            },
          ],
        },
      ],
    },
    { status: { $ne: "rejected" } },
  ],
});

export type LeaderboardScope = "hallOfFame" | "approved";

export type LeaderboardSortKey = "totalPoints" | "achievementsCount" | "latestAchievementDate";

export type LeaderboardStage = "primary" | "middle" | "secondary";

export type LeaderboardFilters = {
  scope?: LeaderboardScope;
  gender?: "male" | "female";
  grade?: string;
  /** When set and `grade` is empty/all, restricts users to grades in this stage (g1–g6, g7–g9, g10–g12). */
  stage?: LeaderboardStage;
  section?: "arabic" | "international";
  academicYear?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: LeaderboardSortKey;
  sortOrder?: "asc" | "desc";
  /** When true, includes cohort summary stats (admin). */
  includeSummary?: boolean;
};

export type LeaderboardItem = {
  userId: string;
  rank: number;
  totalPoints: number;
  achievementsCount: number;
  latestAchievementDate: string | null;
  fullName: string;
  fullNameAr: string;
  fullNameEn: string;
  profilePhoto: string | null;
  grade: string;
  gender: "male" | "female";
  section: "arabic" | "international";
  studentId: string;
};

export type LeaderboardSummary = {
  rankedStudentCount: number;
  sumTotalPoints: number;
  avgPoints: number;
  maxTotalPoints: number;
};

export type LeaderboardPageResult = {
  items: LeaderboardItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: LeaderboardSummary;
};

type AggregatedRow = {
  userId: mongoose.Types.ObjectId;
  totalPoints: number;
  achievementsCount: number;
  latestAchievementDate: Date | null;
  user: {
    fullName?: string;
    fullNameAr?: string;
    fullNameEn?: string;
    profilePhoto?: string;
    grade?: string;
    gender?: "male" | "female";
    section?: "arabic" | "international";
    studentId?: string;
    role?: string;
    status?: string;
  };
};

const asTrimmed = (v: unknown): string => String(v ?? "").trim();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STAGE_GRADE_VALUES: Record<LeaderboardStage, string[]> = {
  primary: ["g1", "g2", "g3", "g4", "g5", "g6"],
  middle: ["g7", "g8", "g9"],
  secondary: ["g10", "g11", "g12"],
};

const normalizePagination = (page?: number, limit?: number) => {
  const normalizedPage = Math.max(1, Number(page || 1));
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit || 24)));
  const skip = (normalizedPage - 1) * normalizedLimit;
  return { page: normalizedPage, limit: normalizedLimit, skip };
};

const buildAchievementMatch = (filters: LeaderboardFilters): Record<string, unknown> => {
  const scope: LeaderboardScope = filters.scope ?? "hallOfFame";
  const base =
    scope === "approved" ? adminApprovedAchievementFilter() : hallOfFameApprovedAchievementFilter();
  const andParts = Array.isArray((base as { $and?: unknown[] }).$and)
    ? [...((base as { $and: Record<string, unknown>[] }).$and || [])]
    : [base];

  const yearRaw = asTrimmed(filters.academicYear);
  const yearNum = Number(yearRaw);
  if (yearRaw && Number.isFinite(yearNum)) {
    andParts.push({ achievementYear: yearNum });
  }
  return { $and: andParts };
};

const buildUserPostLookupMatch = (filters: LeaderboardFilters): Record<string, unknown> => {
  const match: Record<string, unknown> = {
    "user.role": "student",
    "user.status": "active",
  };
  if (filters.gender === "male" || filters.gender === "female") {
    match["user.gender"] = filters.gender;
  }
  const gradeTrim = asTrimmed(filters.grade);
  if (gradeTrim) {
    match["user.grade"] = gradeTrim;
  } else if (
    filters.stage === "primary" ||
    filters.stage === "middle" ||
    filters.stage === "secondary"
  ) {
    match["user.grade"] = { $in: [...STAGE_GRADE_VALUES[filters.stage]] };
  }
  if (filters.section === "arabic" || filters.section === "international") {
    match["user.section"] = filters.section;
  }
  return match;
};

const buildSearchMatch = (filters: LeaderboardFilters): Record<string, unknown> | null => {
  const q = asTrimmed(filters.q);
  if (!q) return null;
  const rx = new RegExp(escapeRegex(q), "i");
  return {
    $or: [
      { "user.fullName": rx },
      { "user.fullNameAr": rx },
      { "user.fullNameEn": rx },
      { "user.studentId": rx },
    ],
  };
};

const SORT_KEYS = new Set<LeaderboardSortKey>([
  "totalPoints",
  "achievementsCount",
  "latestAchievementDate",
]);

const buildSortSpec = (filters: LeaderboardFilters): Record<string, 1 | -1> => {
  const primary: LeaderboardSortKey =
    filters.sortBy && SORT_KEYS.has(filters.sortBy) ? filters.sortBy : "totalPoints";
  const order = filters.sortOrder === "asc" ? 1 : -1;
  const spec: Record<string, 1 | -1> = { [primary]: order };
  if (primary !== "totalPoints") spec.totalPoints = -1;
  if (primary !== "achievementsCount") spec.achievementsCount = -1;
  if (primary !== "latestAchievementDate") spec.latestAchievementDate = -1;
  spec._id = 1;
  return spec;
};

const userProject = {
  fullName: "$user.fullName",
  fullNameAr: "$user.fullNameAr",
  fullNameEn: "$user.fullNameEn",
  profilePhoto: "$user.profilePhoto",
  grade: "$user.grade",
  gender: "$user.gender",
  section: "$user.section",
  studentId: "$user.studentId",
  role: "$user.role",
  status: "$user.status",
};

const toLeaderboardItems = (rows: AggregatedRow[], offset: number): LeaderboardItem[] =>
  rows.map((row, idx) => ({
    userId: String(row.userId),
    rank: offset + idx + 1,
    totalPoints: Number(row.totalPoints || 0),
    achievementsCount: Number(row.achievementsCount || 0),
    latestAchievementDate: row.latestAchievementDate ? new Date(row.latestAchievementDate).toISOString() : null,
    fullName: asTrimmed(row.user?.fullName),
    fullNameAr: asTrimmed(row.user?.fullNameAr),
    fullNameEn: asTrimmed(row.user?.fullNameEn),
    profilePhoto: asTrimmed(row.user?.profilePhoto) || null,
    grade: asTrimmed(row.user?.grade),
    gender: row.user?.gender === "female" ? "female" : "male",
    section: row.user?.section === "international" ? "international" : "arabic",
    studentId: asTrimmed(row.user?.studentId),
  }));

/**
 * Paginated leaderboard with DB-level sort/skip/limit.
 * Tie-break (when primary keys equal): totalPoints desc → achievementsCount desc → latestAchievementDate desc → _id asc.
 */
export const getLeaderboardPage = async (filters: LeaderboardFilters): Promise<LeaderboardPageResult> => {
  await connectDB();
  const { page, limit, skip } = normalizePagination(filters.page, filters.limit);
  const achievementMatch = buildAchievementMatch(filters);
  const userMatch = buildUserPostLookupMatch(filters);
  const searchMatch = buildSearchMatch(filters);
  const sortSpec = buildSortSpec(filters);
  const includeSummary = filters.includeSummary === true;

  const pipeline: mongoose.PipelineStage[] = [
    { $match: achievementMatch },
    {
      $group: {
        _id: "$userId",
        totalPoints: { $sum: { $ifNull: ["$score", 0] } },
        achievementsCount: { $sum: 1 },
        latestAchievementDate: { $max: { $ifNull: ["$date", "$createdAt"] } },
      },
    },
    { $match: { _id: { $type: "objectId" } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: userMatch },
  ];
  if (searchMatch) {
    pipeline.push({ $match: searchMatch });
  }

  const projectRow: mongoose.PipelineStage = {
    $project: {
      _id: 0,
      userId: "$_id",
      totalPoints: 1,
      achievementsCount: 1,
      latestAchievementDate: 1,
      user: userProject,
    },
  };

  if (includeSummary) {
    pipeline.push({
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              rankedStudentCount: { $sum: 1 },
              sumTotalPoints: { $sum: "$totalPoints" },
              maxTotalPoints: { $max: "$totalPoints" },
            },
          },
          {
            $project: {
              _id: 0,
              rankedStudentCount: 1,
              sumTotalPoints: 1,
              maxTotalPoints: 1,
              avgPoints: {
                $cond: [
                  { $eq: ["$rankedStudentCount", 0] },
                  0,
                  { $divide: ["$sumTotalPoints", "$rankedStudentCount"] },
                ],
              },
            },
          },
        ],
        pageItems: [{ $sort: sortSpec }, { $skip: skip }, { $limit: limit }, projectRow],
        totalCount: [{ $count: "n" }],
      },
    });
  } else {
    pipeline.push({
      $facet: {
        pageItems: [{ $sort: sortSpec }, { $skip: skip }, { $limit: limit }, projectRow],
        totalCount: [{ $count: "n" }],
      },
    });
  }

  const raw = (await Achievement.aggregate(pipeline))[0] as {
    summary?: Array<{
      rankedStudentCount: number;
      sumTotalPoints: number;
      maxTotalPoints: number;
      avgPoints: number;
    }>;
    pageItems: AggregatedRow[];
    totalCount: Array<{ n: number }>;
  };

  const total = raw?.totalCount?.[0]?.n ?? 0;
  const pageRows = (raw?.pageItems || []) as AggregatedRow[];
  const items = toLeaderboardItems(pageRows, skip);

  let summary: LeaderboardSummary | undefined;
  if (includeSummary && raw?.summary?.[0]) {
    const s = raw.summary[0];
    summary = {
      rankedStudentCount: Number(s.rankedStudentCount || 0),
      sumTotalPoints: Number(s.sumTotalPoints || 0),
      avgPoints: Number(s.avgPoints || 0),
      maxTotalPoints: Number(s.maxTotalPoints || 0),
    };
  }

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary,
  };
};

/** Public leaderboard (Hall of Fame visibility rules). */
export const getLeaderboard = async (filters: LeaderboardFilters) => {
  return getLeaderboardPage({
    ...filters,
    scope: filters.scope ?? "hallOfFame",
    includeSummary: false,
  });
};

/** Admin leaderboard: all approved achievements, optional summary. */
export const getAdminLeaderboard = async (filters: Omit<LeaderboardFilters, "scope">) => {
  return getLeaderboardPage({
    ...filters,
    scope: "approved",
    includeSummary: true,
  });
};

const runFullRankedList = async (
  filters: Omit<LeaderboardFilters, "page" | "limit" | "sortBy" | "sortOrder" | "includeSummary">
): Promise<LeaderboardItem[]> => {
  await connectDB();
  const achievementMatch = buildAchievementMatch(filters);
  const userMatch = buildUserPostLookupMatch(filters);
  const searchMatch = buildSearchMatch(filters);
  const sortSpec = buildSortSpec({ ...filters, sortBy: "totalPoints", sortOrder: "desc" });

  const pipeline: mongoose.PipelineStage[] = [
    { $match: achievementMatch },
    {
      $group: {
        _id: "$userId",
        totalPoints: { $sum: { $ifNull: ["$score", 0] } },
        achievementsCount: { $sum: 1 },
        latestAchievementDate: { $max: { $ifNull: ["$date", "$createdAt"] } },
      },
    },
    { $match: { _id: { $type: "objectId" } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: userMatch },
  ];
  if (searchMatch) pipeline.push({ $match: searchMatch });
  pipeline.push(
    { $sort: sortSpec },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        totalPoints: 1,
        achievementsCount: 1,
        latestAchievementDate: 1,
        user: userProject,
      },
    }
  );

  const rows = (await Achievement.aggregate(pipeline)) as AggregatedRow[];
  return toLeaderboardItems(rows, 0);
};

export const getStudentRankSummary = async (
  userId: string,
  filters: Omit<LeaderboardFilters, "page" | "limit" | "sortBy" | "sortOrder" | "includeSummary" | "scope"> = {}
) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return {
      totalPoints: 0,
      achievementsCount: 0,
      rank: null as number | null,
      totalRankedStudents: 0,
    };
  }
  const all = await runFullRankedList({ ...filters, scope: "hallOfFame" });
  const idx = all.findIndex((row) => row.userId === userId);
  if (idx < 0) {
    return {
      totalPoints: 0,
      achievementsCount: 0,
      rank: null as number | null,
      totalRankedStudents: all.length,
    };
  }
  const row = all[idx];
  return {
    totalPoints: row.totalPoints,
    achievementsCount: row.achievementsCount,
    rank: row.rank,
    totalRankedStudents: all.length,
  };
};
