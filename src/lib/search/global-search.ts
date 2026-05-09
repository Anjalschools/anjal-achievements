import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniReunionEvent from "@/models/AlumniReunionEvent";
import AlumniStory from "@/models/AlumniStory";
import AlumniCohort from "@/models/AlumniCohort";
import { escapeRegExp, type NormalizedQuery } from "./query-normalizer";
import { rankAlumniRows, type AlumniSearchRow } from "./ranking-engine";

export type Pagination = { page: number; pageSize: number };

export type AlumniSearchOptions = {
  verifiedOnly?: boolean;
};

export type SearchHitType =
  | "alumni"
  | "mentor"
  | "opportunity"
  | "event"
  | "story"
  | "cohort"
  | "university"
  | "career";

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  rankScore: number;
  rankHighlights: string[];
  /** Public slug for events/stories when available */
  slug?: string;
  /** Cohort graduation year when type === cohort */
  cohortYear?: number;
};

const clampPage = (p: number) => Math.max(1, Math.min(500, p));
const clampSize = (s: number) => Math.max(1, Math.min(40, s));

export const privacySearchableMatch = (): Record<string, unknown> => ({
  $nor: [{ "alumniProfile.privacySettings.searchable": false }],
});

const mentorDiscoverableMatch = (): Record<string, unknown> => ({
  "alumniProfile.alumniServices.mentoring": true,
  $nor: [
    { "alumniProfile.privacySettings.searchable": false },
    { "alumniProfile.privacySettings.publicProfile": false },
    { "alumniProfile.privacySettings.allowMentorshipRequests": false },
  ],
});

const tokenOrClause = (tokens: string[]): Record<string, unknown>[] => {
  if (!tokens.length) return [];
  return tokens.flatMap((t) => {
    const re = new RegExp(escapeRegExp(t), "i");
    return [
      { fullName: re },
      { fullNameAr: re },
      { fullNameEn: re },
      { "alumniProfile.universityName": re },
      { "alumniProfile.major": re },
      { "alumniProfile.currentCompany": re },
      { "alumniProfile.currentPosition": re },
      { "alumniProfile.industry": re },
      { "alumniProfile.city": re },
      { "alumniProfile.country": re },
      { "alumniProfile.bio": re },
      { "alumniProfile.studyCountry": re },
      { "alumniProfile.interests": re },
    ];
  });
};

const mapUserToAlumniRow = (row: any): AlumniSearchRow => {
  const p = row.alumniProfile || {};
  return {
    id: row._id.toString(),
    fullName: row.fullName || "",
    universityName: p.universityName ?? null,
    company: p.currentCompany ?? null,
    position: p.currentPosition ?? null,
    industry: p.industry ?? null,
    graduationYear: p.graduationYear ?? null,
    country: p.country ?? null,
    city: p.city ?? null,
    bio: p.bio ?? null,
    isVerifiedAlumni: p.isVerifiedAlumni === true,
    isFeaturedAlumni: p.isFeaturedAlumni === true,
    mentoring: p.alumniServices?.mentoring === true,
    updatedAt: row.updatedAt ?? null,
    lastLoginAt: row.lastLoginAt ?? null,
    interests: Array.isArray(p.interests) ? p.interests : null,
  };
};

const toAlumniHits = (
  slice: Array<
    AlumniSearchRow & {
      rankScore: number;
      rankHighlights: string[];
    }
  >
): SearchHit[] =>
  slice.map((r) => ({
    type: "alumni",
    id: r.id,
    title: r.fullName,
    subtitle: [r.universityName, r.company].filter(Boolean).join(" · "),
    meta: r.graduationYear ? String(r.graduationYear) : r.industry || "",
    rankScore: r.rankScore,
    rankHighlights: r.rankHighlights,
  }));

export const searchAlumni = async (nq: NormalizedQuery, pag: Pagination, options?: AlumniSearchOptions) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const tokens = nq.tokens;

  const base: Record<string, unknown> = {
    accountType: "alumni",
    ...privacySearchableMatch(),
  };

  if (options?.verifiedOnly) {
    base["alumniProfile.isVerifiedAlumni"] = true;
  }

  if (tokens.length) {
    base.$or = tokenOrClause(tokens);
  }

  const raw = await User.find(base)
    .select("fullName fullNameAr fullNameEn lastLoginAt updatedAt alumniProfile")
    .sort({ updatedAt: -1 })
    .limit(180)
    .lean();

  const rows = raw.map(mapUserToAlumniRow);
  const ranked = tokens.length
    ? rankAlumniRows(tokens, rows)
    : rows.map((r) => ({ ...r, rankScore: 0, rankHighlights: [] as string[] }));
  const start = (page - 1) * pageSize;
  const slice = ranked.slice(start, start + pageSize);
  return {
    items: toAlumniHits(slice),
    totalEstimate: ranked.length,
  };
};

export const searchMentors = async (nq: NormalizedQuery, pag: Pagination, options?: AlumniSearchOptions) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const tokens = nq.tokens;

  const base: Record<string, unknown> = {
    accountType: "alumni",
    ...mentorDiscoverableMatch(),
  };

  if (options?.verifiedOnly) {
    base["alumniProfile.isVerifiedAlumni"] = true;
  }

  if (tokens.length) {
    base.$or = tokenOrClause(tokens);
  }

  const raw = await User.find(base)
    .select("fullName lastLoginAt updatedAt alumniProfile")
    .sort({ updatedAt: -1 })
    .limit(120)
    .lean();

  const rows = raw.map(mapUserToAlumniRow);
  const ranked = tokens.length
    ? rankAlumniRows(tokens, rows)
    : rows.map((r) => ({ ...r, rankScore: 0, rankHighlights: [] as string[] }));
  const start = (page - 1) * pageSize;
  const slice = ranked.slice(start, start + pageSize);
  return {
    items: slice.map((r) => ({
      type: "mentor" as const,
      id: r.id,
      title: r.fullName,
      subtitle: [r.universityName, r.company].filter(Boolean).join(" · "),
      meta: r.industry || "",
      rankScore: r.rankScore,
      rankHighlights: r.rankHighlights,
    })),
    totalEstimate: ranked.length,
  };
};

const oppMatch = (tokens: string[]) => {
  const published: Record<string, unknown> = {
    published: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
  if (!tokens.length) return published;
  const or = tokens.flatMap((t) => {
    const re = new RegExp(escapeRegExp(t), "i");
    return [{ title: re }, { description: re }, { company: re }, { location: re }, { type: re }];
  });
  return { ...published, $and: [{ $or: or }] };
};

export const searchOpportunities = async (nq: NormalizedQuery, pag: Pagination) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const filter = oppMatch(nq.tokens);
  const raw = await AlumniOpportunity.find(filter)
    .select("title type company location featured")
    .sort({ featured: -1, updatedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const totalEstimate = await AlumniOpportunity.countDocuments(filter);
  return {
    items: raw.map((row: any) => ({
      type: "opportunity" as const,
      id: row._id.toString(),
      title: row.title,
      subtitle: [row.company, row.type].filter(Boolean).join(" · "),
      meta: row.location || "",
      rankScore: row.featured ? 10 : 0,
      rankHighlights: row.featured ? (["featured"] as string[]) : ([] as string[]),
    })),
    totalEstimate,
  };
};

const eventMatch = (tokens: string[]) => {
  if (!tokens.length) return { published: true } as Record<string, unknown>;
  const or = tokens.flatMap((t) => {
    const re = new RegExp(escapeRegExp(t), "i");
    return [{ title: re }, { summary: re }, { location: re }, { slug: re }];
  });
  return { published: true, $or: or };
};

export const searchEvents = async (nq: NormalizedQuery, pag: Pagination) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const filter = eventMatch(nq.tokens);
  const raw = await AlumniReunionEvent.find(filter)
    .select("title slug summary startsAt location")
    .sort({ startsAt: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const totalEstimate = await AlumniReunionEvent.countDocuments(filter);
  return {
    items: raw.map((row: any) => ({
      type: "event" as const,
      id: row._id.toString(),
      title: row.title,
      subtitle: (row.summary && String(row.summary).slice(0, 120)) || row.slug,
      meta: row.startsAt ? new Date(row.startsAt).toISOString().slice(0, 10) : "",
      rankScore: 0,
      rankHighlights: [] as string[],
      slug: row.slug,
    })),
    totalEstimate,
  };
};

const storyMatch = (tokens: string[]) => {
  if (!tokens.length) return { published: true } as Record<string, unknown>;
  const or = tokens.flatMap((t) => {
    const re = new RegExp(escapeRegExp(t), "i");
    return [{ title: re }, { excerpt: re }, { universityName: re }, { currentCompany: re }];
  });
  return { published: true, $or: or };
};

export const searchStories = async (nq: NormalizedQuery, pag: Pagination) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const filter = storyMatch(nq.tokens);
  const raw = await AlumniStory.find(filter)
    .select("title slug excerpt universityName featured publishedAt")
    .sort({ featured: -1, publishedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const totalEstimate = await AlumniStory.countDocuments(filter);
  return {
    items: raw.map((row: any) => ({
      type: "story" as const,
      id: row._id.toString(),
      title: row.title,
      subtitle: (row.excerpt && String(row.excerpt).slice(0, 140)) || "",
      meta: row.universityName || "",
      rankScore: row.featured ? 5 : 0,
      rankHighlights: row.featured ? (["featured"] as string[]) : ([] as string[]),
      slug: row.slug,
    })),
    totalEstimate,
  };
};

const cohortMatch = (tokens: string[]): Record<string, unknown> => {
  if (!tokens.length) return {};
  const or = tokens.flatMap((t) => {
    const n = Number(t);
    if (Number.isFinite(n) && n > 1950 && n < 2100) {
      return [{ graduationYear: n }, { label: new RegExp(escapeRegExp(t), "i") }];
    }
    return [{ label: new RegExp(escapeRegExp(t), "i") }];
  });
  return { $or: or };
};

export const searchCohorts = async (nq: NormalizedQuery, pag: Pagination) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const filter = cohortMatch(nq.tokens);
  const q = Object.keys(filter).length ? filter : {};
  const raw = await AlumniCohort.find(q)
    .select("graduationYear label featured")
    .sort({ featured: -1, graduationYear: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const totalEstimate = await AlumniCohort.countDocuments(q);
  return {
    items: raw.map((row: any) => ({
      type: "cohort" as const,
      id: row._id.toString(),
      title: `دفعة ${row.graduationYear}`,
      subtitle: row.label || "",
      meta: row.featured ? "مميزة" : "",
      rankScore: 0,
      rankHighlights: [] as string[],
      cohortYear: row.graduationYear,
    })),
    totalEstimate,
  };
};

export const searchUniversities = async (nq: NormalizedQuery, pag: Pagination) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const tokens = nq.tokens;
  const match: Record<string, unknown> = {
    accountType: "alumni",
    ...privacySearchableMatch(),
    "alumniProfile.universityName": { $exists: true, $nin: [null, ""] },
  };
  if (tokens.length) {
    match.$or = tokenOrClause(tokens);
  }

  const [rows, countAgg] = await Promise.all([
    User.aggregate<{ _id: string; count: number; verified: number }>([
      { $match: match },
      {
        $group: {
          _id: "$alumniProfile.universityName",
          count: { $sum: 1 },
          verified: {
            $sum: {
              $cond: [{ $eq: ["$alumniProfile.isVerifiedAlumni", true] }, 1, 0],
            },
          },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
    ]),
    User.aggregate<{ c: number }>([
      { $match: match },
      { $group: { _id: "$alumniProfile.universityName" } },
      { $count: "c" },
    ]),
  ]);

  const totalEstimate = countAgg[0]?.c ?? 0;
  return {
    items: rows.map((r) => {
      const rate = r.count > 0 ? Math.round((r.verified / r.count) * 100) : 0;
      return {
        type: "university" as const,
        id: r._id,
        title: r._id,
        subtitle: `${r.count}`,
        meta: `${rate}%`,
        rankScore: r.count,
        rankHighlights: [] as string[],
      };
    }),
    totalEstimate,
  };
};

export const searchCareers = async (nq: NormalizedQuery, pag: Pagination) => {
  const page = clampPage(pag.page);
  const pageSize = clampSize(pag.pageSize);
  const tokens = nq.tokens;
  const match: Record<string, unknown> = {
    accountType: "alumni",
    ...privacySearchableMatch(),
    "alumniProfile.currentCompany": { $exists: true, $nin: [null, ""] },
  };
  if (tokens.length) {
    match.$or = tokenOrClause(tokens);
  }

  const [rows, countAgg] = await Promise.all([
    User.aggregate<{ _id: string; count: number; industry: string | null }>([
      { $match: match },
      {
        $group: {
          _id: "$alumniProfile.currentCompany",
          count: { $sum: 1 },
          industry: { $max: "$alumniProfile.industry" },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
    ]),
    User.aggregate<{ c: number }>([
      { $match: match },
      { $group: { _id: "$alumniProfile.currentCompany" } },
      { $count: "c" },
    ]),
  ]);

  const totalEstimate = countAgg[0]?.c ?? 0;
  return {
    items: rows.map((r) => ({
      type: "career" as const,
      id: r._id,
      title: r._id,
      subtitle: r.industry || "",
      meta: String(r.count),
      rankScore: r.count,
      rankHighlights: [] as string[],
    })),
    totalEstimate,
  };
};

export const searchGlobal = async (nq: NormalizedQuery, pag: Pagination) => {
  const [alumni, opps, events, stories, mentors, cohorts] = await Promise.all([
    searchAlumni(nq, { ...pag, pageSize: 8 }),
    searchOpportunities(nq, { ...pag, pageSize: 6 }),
    searchEvents(nq, { ...pag, pageSize: 6 }),
    searchStories(nq, { ...pag, pageSize: 6 }),
    searchMentors(nq, { ...pag, pageSize: 6 }),
    searchCohorts(nq, { ...pag, pageSize: 5 }),
  ]);

  return {
    alumni: alumni.items,
    opportunities: opps.items,
    events: events.items,
    stories: stories.items,
    mentors: mentors.items,
    cohorts: cohorts.items,
    totals: {
      alumni: alumni.totalEstimate,
      opportunities: opps.totalEstimate,
      events: events.totalEstimate,
      stories: stories.totalEstimate,
      mentors: mentors.totalEstimate,
      cohorts: cohorts.totalEstimate,
    },
  };
};
