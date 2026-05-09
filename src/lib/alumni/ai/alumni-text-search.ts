import User from "@/models/User";
import type { AlumniSearchHit } from "./types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  const q = raw.trim();
  if (q.length < 2) return [];

  const parts = q
    .split(/[\s,،]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 8);

  if (!parts.length) return [];

  const clauses = parts.map((p) => {
    const re = new RegExp(escapeRegExp(p), "i");
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

  const rows = await User.find({
    accountType: "alumni",
    $or: clauses.flat(),
  })
    .select("fullName alumniProfile")
    .limit(limit)
    .lean();

  return toHits(rows);
};
