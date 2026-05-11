import User from "@/models/User";
import { buildAlumniSearchRegexPattern, normalizeAlumniSearchToken } from "@/lib/alumni/arabic-search-normalize";
import type { AlumniSearchHit } from "./types";

const toHits = (rows: any[]): AlumniSearchHit[] =>
  rows.map((row) => {
    const p = row.alumniProfile || {};
    return {
      id: row._id.toString(),
      fullName: row.fullName || "",
      universityName: p.universityName ?? null,
      company: p.currentCompany ?? null,
      industry: p.industry ?? null,
      major: p.major ?? null,
      isVerifiedAlumni: p.isVerifiedAlumni === true,
      mentoringAvailable: p.alumniServices?.mentoring === true,
    };
  });

/** Tokenized OR search across common alumni profile fields (no external AI). */
export const searchAlumniDirectory = async (raw: string, limit = 18): Promise<AlumniSearchHit[]> => {
  const trimmed = String(raw ?? "").trim();
  if (trimmed.length < 2) return [];

  const parts = trimmed
    .split(/[\s,،]+/u)
    .map((s) => normalizeAlumniSearchToken(s))
    .filter((s) => s.length >= 2)
    .slice(0, 8);

  if (!parts.length) return [];

  const clauses = parts.flatMap((p) => {
    const pat = buildAlumniSearchRegexPattern(p);
    if (!pat) return [];
    const re = new RegExp(pat, "i");
    return [
      { fullName: re },
      { "alumniProfile.universityName": re },
      { "alumniProfile.currentCompany": re },
      { "alumniProfile.industry": re },
      { "alumniProfile.major": re },
      { "alumniProfile.bio": re },
      { "alumniProfile.city": re },
      { "alumniProfile.country": re },
    ];
  });

  if (!clauses.length) return [];

  const rows = await User.find({
    accountType: "alumni",
    $or: clauses,
  })
    .select("fullName alumniProfile")
    .limit(limit)
    .lean();

  return toHits(rows);
};
