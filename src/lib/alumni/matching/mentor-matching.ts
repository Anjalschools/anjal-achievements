/**
 * Weighted, rule-based mentor / peer similarity scoring (no external AI).
 * Exposes per-dimension weights and boolean signals for explainable recommendations.
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
  /** Interest tags from profile — used for mutual-interest matches. */
  interests?: string[] | null;
  bio?: string | null;
  updatedAt?: Date | null;
  lastLoginAt?: Date | null;
  isVerifiedAlumni?: boolean;
  reputationScore?: number | null;
};

/** Theoretical upper bound for normalization (sum of non-overlapping maxima). */
export const MENTOR_SCORE_MAX = 165;

export type MentorScoreBreakdown = {
  score: number;
  reasons: string[];
  weights: Record<string, number>;
  matchedSignals: Record<string, boolean>;
  maxScore: number;
  confidence: number;
  relevanceScore: number;
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
): MentorScoreBreakdown => {
  const weights: Record<string, number> = {};
  const matchedSignals: Record<string, boolean> = {
    same_university: false,
    same_major: false,
    same_industry: false,
    same_country: false,
    mentor_active: false,
    verified: false,
    reputation: false,
    same_graduation_year: false,
    grad_year_proximity: false,
    mutual_interests: false,
    category_in_bio: false,
    interest_match: false,
  };

  const reasons: string[] = [];
  if (selfId && mentor.id === selfId) {
    return {
      score: -1,
      reasons: [],
      weights: {},
      matchedSignals,
      maxScore: MENTOR_SCORE_MAX,
      confidence: 0,
      relevanceScore: 0,
    };
  }

  let score = 0;
  const vu = norm(viewer.universityName);
  const mu = norm(mentor.universityName);
  if (vu && mu && vu === mu) {
    score += 30;
    weights.university = 30;
    matchedSignals.same_university = true;
    reasons.push("same_university");
  }

  const vm = norm(viewer.major);
  const mm = norm(mentor.major);
  if (vm && mm && (vm === mm || vm.includes(mm) || mm.includes(vm))) {
    score += 25;
    weights.major = 25;
    matchedSignals.same_major = true;
    reasons.push("same_major");
  }

  const vi = norm(viewer.industry);
  const mi = norm(mentor.industry);
  if (vi && mi && (vi === mi || vi.includes(mi) || mi.includes(vi))) {
    score += 20;
    weights.industry = 20;
    matchedSignals.same_industry = true;
    reasons.push("same_industry");
  }

  const vc = norm(viewer.country) || norm(viewer.studyCountry);
  const mc = norm(mentor.country) || norm(mentor.studyCountry);
  if (vc && mc && vc === mc) {
    score += 15;
    weights.country = 15;
    matchedSignals.same_country = true;
    reasons.push("same_country");
  }

  const act = mentorActivityBonus(mentor);
  if (act > 0) {
    score += act;
    weights.activity = act;
    matchedSignals.mentor_active = true;
    reasons.push("mentor_active");
  }

  if (mentor.isVerifiedAlumni) {
    score += 8;
    weights.verified = 8;
    matchedSignals.verified = true;
    reasons.push("verified");
  }

  const rs = Number(mentor.reputationScore || 0);
  if (rs > 0) {
    const repBonus = Math.min(12, Math.floor(rs / 25));
    if (repBonus > 0) {
      score += repBonus;
      weights.reputation = repBonus;
      matchedSignals.reputation = true;
      reasons.push("reputation");
    }
  }

  if (viewer.graduationYear && mentor.graduationYear) {
    const diff = Math.abs(viewer.graduationYear - mentor.graduationYear);
    if (viewer.graduationYear === mentor.graduationYear) {
      score += 12;
      weights.graduation = 12;
      matchedSignals.same_graduation_year = true;
      reasons.push("same_graduation_year");
    } else if (diff <= 3) {
      score += 5;
      weights.graduation_proximity = 5;
      matchedSignals.grad_year_proximity = true;
      reasons.push("grad_year_proximity");
    }
  }

  const viewerInterestSet = new Set((viewer.interests || []).map(norm).filter(Boolean));
  const mentorInterestSet = new Set((mentor.interests || []).map(norm).filter(Boolean));
  if (viewerInterestSet.size && mentorInterestSet.size) {
    let overlap = 0;
    for (const t of viewerInterestSet) {
      if (mentorInterestSet.has(t)) overlap += 1;
    }
    if (overlap > 0) {
      const w = Math.min(18, overlap * 6);
      score += w;
      weights.mutual_interests = w;
      matchedSignals.mutual_interests = true;
      reasons.push("mutual_interests");
    }
  }

  const cat = norm(viewer.mentorshipCategory);
  if (cat && mentor.bio) {
    const b = norm(mentor.bio);
    if (b.includes(cat)) {
      score += 7;
      weights.category_bio = 7;
      matchedSignals.category_in_bio = true;
      reasons.push("category_in_bio");
    }
  }

  const ints = (viewer.interests || []).map(norm).filter(Boolean);
  const blob = [mentor.bio, mentor.major, mentor.industry].map(norm).join(" ");
  for (const t of ints) {
    if (t.length > 2 && blob.includes(t)) {
      score += 6;
      weights.interest_text = 6;
      matchedSignals.interest_match = true;
      reasons.push("interest_match");
      break;
    }
  }

  const confidence = score <= 0 ? 0 : Math.min(0.98, score / MENTOR_SCORE_MAX);
  const relevanceScore = Math.round((Math.min(score, MENTOR_SCORE_MAX) / MENTOR_SCORE_MAX) * 1000) / 10;

  return {
    score,
    reasons,
    weights,
    matchedSignals,
    maxScore: MENTOR_SCORE_MAX,
    confidence,
    relevanceScore,
  };
};

export type RankedMentor = MentorCandidate & {
  matchScore: number;
  matchReasons: string[];
  matchWeights: Record<string, number>;
  matchedSignals: Record<string, boolean>;
  matchConfidence: number;
  matchRelevanceScore: number;
};

export const rankMentors = (
  viewer: MatchProfileInput,
  mentors: MentorCandidate[],
  selfId?: string,
  limit = 12
): RankedMentor[] => {
  const scored = mentors
    .map((m) => {
      const b = scoreMentor(viewer, m, selfId);
      return {
        ...m,
        matchScore: b.score,
        matchReasons: b.reasons,
        matchWeights: b.weights,
        matchedSignals: b.matchedSignals,
        matchConfidence: b.confidence,
        matchRelevanceScore: b.relevanceScore,
      };
    })
    .filter((x) => x.matchScore >= 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
};
