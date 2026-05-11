/**
 * Deterministic weighted ranking for alumni discovery (keyword / profile match).
 */

export type AlumniSearchRow = {
  id: string;
  fullName: string;
  universityName?: string | null;
  company?: string | null;
  position?: string | null;
  industry?: string | null;
  graduationYear?: number | null;
  major?: string | null;
  country?: string | null;
  city?: string | null;
  bio?: string | null;
  isVerifiedAlumni?: boolean;
  isFeaturedAlumni?: boolean;
  mentoring?: boolean;
  updatedAt?: Date | null;
  lastLoginAt?: Date | null;
  interests?: string[] | null;
};

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

export const scoreAlumniRow = (tokens: string[], row: AlumniSearchRow): { score: number; highlights: string[] } => {
  const highlights: string[] = [];
  let score = 0;
  const name = norm(row.fullName);
  const uni = norm(row.universityName);
  const co = norm(row.company);
  const pos = norm(row.position);
  const ind = norm(row.industry);
  const maj = norm(row.major);
  const bio = norm(row.bio);
  const blob = [name, uni, co, pos, ind, maj, bio, ...(row.interests || []).map(norm)].join(" ");

  for (const t of tokens) {
    const tl = t.toLowerCase();
    if (!tl) continue;
    if (name === tl) {
      score += 120;
      highlights.push("exact_name");
    } else if (name.includes(tl)) {
      score += 85;
      highlights.push("name");
    }
    if (uni.includes(tl)) {
      score += 45;
      highlights.push("university");
    }
    if (co.includes(tl) || pos.includes(tl)) {
      score += 38;
      highlights.push("career");
    }
    if (ind.includes(tl)) {
      score += 32;
      highlights.push("industry");
    }
    if (maj.includes(tl)) {
      score += 34;
      highlights.push("major");
    }
    if (bio.includes(tl)) {
      score += 18;
      highlights.push("bio");
    }
    if (blob.includes(tl)) {
      score += 6;
    }
  }

  if (row.isVerifiedAlumni) {
    score += 22;
    highlights.push("verified");
  }
  if (row.isFeaturedAlumni) {
    score += 18;
    highlights.push("featured");
  }
  if (row.mentoring) {
    score += 16;
    highlights.push("mentor");
  }

  const recent = (d: Date | null | undefined) => {
    if (!d || !(d instanceof Date)) return false;
    return Date.now() - d.getTime() < 120 * 86_400_000;
  };
  if (recent(row.lastLoginAt) || recent(row.updatedAt)) {
    score += 12;
    highlights.push("active");
  }

  return { score, highlights: [...new Set(highlights)] };
};

export const rankAlumniRows = <T extends AlumniSearchRow>(tokens: string[], rows: T[]): Array<T & { rankScore: number; rankHighlights: string[] }> => {
  if (!tokens.length) {
    return rows.map((r) => ({ ...r, rankScore: 0, rankHighlights: [] as string[] }));
  }
  return rows
    .map((r) => {
      const { score, highlights } = scoreAlumniRow(tokens, r);
      return { ...r, rankScore: score, rankHighlights: highlights };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
};
