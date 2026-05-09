/**
 * Rule-based mentor scoring (no external AI).
 * Weights tuned for explainable recommendations.
 */

export type MatchProfileInput = {
  universityName?: string;
  major?: string;
  industry?: string;
  country?: string;
  studyCountry?: string;
  graduationYear?: number;
  interests?: string[];
  mentorshipCategory?: string;
};

export type MentorCandidate = {
  id: string;
  fullName: string;
  universityName?: string | null;
  major?: string | null;
  industry?: string | null;
  country?: string | null;
  studyCountry?: string | null;
  graduationYear?: number | null;
  bio?: string | null;
  updatedAt?: Date | null;
  lastLoginAt?: Date | null;
  isVerifiedAlumni?: boolean;
  reputationScore?: number | null;
};

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

const daysSince = (d: Date | null | undefined): number | null => {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
};

/** +10 if mentor profile or login looks recently active */
export const mentorActivityBonus = (m: MentorCandidate): number => {
  const lu = daysSince(m.lastLoginAt ?? undefined);
  const up = daysSince(m.updatedAt ?? undefined);
  if (lu !== null && lu <= 120) return 10;
  if (up !== null && up <= 90) return 10;
  return 0;
};

export const scoreMentor = (
  viewer: MatchProfileInput,
  mentor: MentorCandidate,
  selfId?: string
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  if (selfId && mentor.id === selfId) return { score: -1, reasons: [] };

  let score = 0;
  const vu = norm(viewer.universityName);
  const mu = norm(mentor.universityName);
  if (vu && mu && vu === mu) {
    score += 30;
    reasons.push("same_university");
  }

  const vm = norm(viewer.major);
  const mm = norm(mentor.major);
  if (vm && mm && (vm === mm || vm.includes(mm) || mm.includes(vm))) {
    score += 25;
    reasons.push("same_major");
  }

  const vi = norm(viewer.industry);
  const mi = norm(mentor.industry);
  if (vi && mi && (vi === mi || vi.includes(mi) || mi.includes(vi))) {
    score += 20;
    reasons.push("same_industry");
  }

  const vc = norm(viewer.country) || norm(viewer.studyCountry);
  const mc = norm(mentor.country) || norm(mentor.studyCountry);
  if (vc && mc && vc === mc) {
    score += 15;
    reasons.push("same_country");
  }

  const act = mentorActivityBonus(mentor);
  if (act > 0) {
    score += act;
    reasons.push("mentor_active");
  }

  if (mentor.isVerifiedAlumni) {
    score += 8;
    reasons.push("verified");
  }

  const rs = Number(mentor.reputationScore || 0);
  if (rs > 0) {
    const repBonus = Math.min(12, Math.floor(rs / 25));
    score += repBonus;
    if (repBonus > 0) reasons.push("reputation");
  }

  if (viewer.graduationYear && mentor.graduationYear) {
    const diff = Math.abs(viewer.graduationYear - mentor.graduationYear);
    if (diff <= 3) {
      score += 5;
      reasons.push("grad_year_proximity");
    }
  }

  const cat = norm(viewer.mentorshipCategory);
  if (cat && mentor.bio) {
    const b = norm(mentor.bio);
    if (b.includes(cat)) {
      score += 7;
      reasons.push("category_in_bio");
    }
  }

  const ints = (viewer.interests || []).map(norm).filter(Boolean);
  const blob = [mentor.bio, mentor.major, mentor.industry].map(norm).join(" ");
  for (const t of ints) {
    if (t.length > 2 && blob.includes(t)) {
      score += 6;
      reasons.push("interest_match");
      break;
    }
  }

  return { score, reasons };
};

export const rankMentors = (
  viewer: MatchProfileInput,
  mentors: MentorCandidate[],
  selfId?: string,
  limit = 12
): Array<MentorCandidate & { matchScore: number; matchReasons: string[] }> => {
  const scored = mentors
    .map((m) => {
      const { score, reasons } = scoreMentor(viewer, m, selfId);
      return { ...m, matchScore: score, matchReasons: reasons };
    })
    .filter((x) => x.matchScore >= 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
};
