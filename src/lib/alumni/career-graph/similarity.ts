import {
  scoreMentor,
  type MatchProfileInput,
  type MentorCandidate,
} from "@/lib/alumni/matching/mentor-matching";

const toViewer = (c: MentorCandidate): MatchProfileInput => ({
  universityName: c.universityName ?? undefined,
  major: c.major ?? undefined,
  industry: c.industry ?? undefined,
  country: c.country ?? undefined,
  studyCountry: c.studyCountry ?? undefined,
  graduationYear: c.graduationYear ?? undefined,
});

/** Symmetric affinity (0+) for graph edges and pathways. */
export const symmetricAlumniAffinity = (
  a: MentorCandidate,
  b: MentorCandidate
): { weight: number; reasons: string[] } => {
  const f = scoreMentor(toViewer(a), b, a.id);
  const r = scoreMentor(toViewer(b), a, b.id);
  if (f.score < 0 || r.score < 0) return { weight: 0, reasons: [] };
  const reasons = [...new Set([...f.reasons, ...r.reasons])];
  return { weight: Math.round((f.score + r.score) / 2), reasons };
};
