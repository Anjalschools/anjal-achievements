import type { MatchProfileInput } from "@/lib/alumni/matching/mentor-matching";

export type AlumniEventCandidate = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  eventType: string;
  cohortYear?: number | null;
  location?: string | null;
  featured?: boolean;
  startsAt: Date;
};

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

/** Upper bound for rule weights (used for confidence / relevance normalization). */
export const ALUMNI_EVENT_SCORE_MAX = 120;

export const scoreAlumniEvent = (
  viewer: MatchProfileInput,
  ev: AlumniEventCandidate
): {
  score: number;
  reasons: string[];
  weights: Record<string, number>;
  matchedSignals: Record<string, boolean>;
  confidence: number;
  relevanceScore: number;
} => {
  const reasons: string[] = [];
  const weights: Record<string, number> = {};
  const matchedSignals: Record<string, boolean> = {
    university_mention: false,
    cohort_year_match: false,
    industry_or_major_mention: false,
    country_or_location: false,
    interest_keyword: false,
    featured: false,
    upcoming_soon: false,
  };

  const hay = norm(`${ev.title} ${ev.summary || ""} ${ev.content || ""} ${ev.location || ""}`);
  let score = 0;

  const vu = norm(viewer.universityName);
  if (vu && hay.includes(vu)) {
    score += 32;
    weights.university = 32;
    matchedSignals.university_mention = true;
    reasons.push("university_mention");
  }

  if (
    viewer.graduationYear &&
    ev.cohortYear != null &&
    Number(ev.cohortYear) === viewer.graduationYear
  ) {
    score += 28;
    weights.cohort_year = 28;
    matchedSignals.cohort_year_match = true;
    reasons.push("cohort_year_match");
  }

  const vm = norm(viewer.major);
  const vi = norm(viewer.industry);
  if (vm && hay.includes(vm)) {
    score += 18;
    weights.major = 18;
    matchedSignals.industry_or_major_mention = true;
    reasons.push("major_mention");
  } else if (vi && hay.includes(vi)) {
    score += 16;
    weights.industry = 16;
    matchedSignals.industry_or_major_mention = true;
    reasons.push("industry_mention");
  }

  const vc = norm(viewer.country) || norm(viewer.studyCountry);
  const loc = norm(ev.location || "");
  if (vc && (hay.includes(vc) || loc.includes(vc))) {
    score += 12;
    weights.location = 12;
    matchedSignals.country_or_location = true;
    reasons.push("location_country");
  }

  for (const t of (viewer.interests || []).map(norm)) {
    if (t.length > 2 && hay.includes(t)) {
      score += 10;
      weights.interest = 10;
      matchedSignals.interest_keyword = true;
      reasons.push("interest_keyword");
      break;
    }
  }

  if (ev.featured) {
    score += 8;
    weights.featured = 8;
    matchedSignals.featured = true;
    reasons.push("featured");
  }

  const starts = ev.startsAt instanceof Date ? ev.startsAt : new Date(ev.startsAt);
  const days = (starts.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days >= 0 && days <= 21) {
    score += 6;
    weights.recency = 6;
    matchedSignals.upcoming_soon = true;
    reasons.push("upcoming_soon");
  }

  const confidence = score <= 0 ? 0 : Math.min(0.98, score / ALUMNI_EVENT_SCORE_MAX);
  const relevanceScore = Math.round((Math.min(score, ALUMNI_EVENT_SCORE_MAX) / ALUMNI_EVENT_SCORE_MAX) * 1000) / 10;

  return { score, reasons, weights, matchedSignals, confidence, relevanceScore };
};

export type RankedAlumniEvent = AlumniEventCandidate & {
  matchScore: number;
  matchReasons: string[];
  matchWeights: Record<string, number>;
  matchedSignals: Record<string, boolean>;
  confidence: number;
  relevanceScore: number;
};

export const rankAlumniEvents = (viewer: MatchProfileInput, events: AlumniEventCandidate[], limit = 12): RankedAlumniEvent[] => {
  return events
    .map((ev) => {
      const r = scoreAlumniEvent(viewer, ev);
      return {
        ...ev,
        matchScore: r.score,
        matchReasons: r.reasons,
        matchWeights: r.weights,
        matchedSignals: r.matchedSignals,
        confidence: r.confidence,
        relevanceScore: r.relevanceScore,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
};
