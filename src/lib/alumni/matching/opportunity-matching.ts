import type { MatchProfileInput } from "@/lib/alumni/matching/mentor-matching";

export type OpportunityCandidate = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  company?: string | null;
  location?: string | null;
  featured?: boolean;
};

export const OPPORTUNITY_SCORE_MAX = 115;

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

export type OpportunityScoreBreakdown = {
  score: number;
  reasons: string[];
  weights: Record<string, number>;
  matchedSignals: Record<string, boolean>;
  confidence: number;
  relevanceScore: number;
};

export const scoreOpportunity = (viewer: MatchProfileInput, opp: OpportunityCandidate): OpportunityScoreBreakdown => {
  const reasons: string[] = [];
  const weights: Record<string, number> = {};
  const matchedSignals: Record<string, boolean> = {
    university_mention: false,
    industry_match: false,
    major_mention: false,
    location_country: false,
    interest_keyword: false,
    featured: false,
    category_match: false,
    type_job_affinity: false,
  };

  let score = 0;
  const hay = norm(`${opp.title} ${opp.description || ""} ${opp.company || ""} ${opp.location || ""}`);

  const vu = norm(viewer.universityName);
  if (vu && hay.includes(vu)) {
    score += 28;
    weights.university = 28;
    matchedSignals.university_mention = true;
    reasons.push("university_mention");
  }

  const vi = norm(viewer.industry);
  if (vi && (hay.includes(vi) || norm(opp.title).includes(vi))) {
    score += 25;
    weights.industry = 25;
    matchedSignals.industry_match = true;
    reasons.push("industry_match");
  }

  const vm = norm(viewer.major);
  if (vm && hay.includes(vm)) {
    score += 18;
    weights.major = 18;
    matchedSignals.major_mention = true;
    reasons.push("major_mention");
  }

  const vc = norm(viewer.country) || norm(viewer.studyCountry);
  if (vc && hay.includes(vc)) {
    score += 12;
    weights.location = 12;
    matchedSignals.location_country = true;
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

  if (opp.featured) {
    score += 8;
    weights.featured = 8;
    matchedSignals.featured = true;
    reasons.push("featured");
  }

  const cat = norm(viewer.mentorshipCategory);
  if (cat && hay.includes(cat)) {
    score += 8;
    weights.category = 8;
    matchedSignals.category_match = true;
    reasons.push("category_match");
  }

  const ty = norm(opp.type);
  if (ty === "internship" || ty === "job") {
    score += 4;
    weights.type = 4;
    matchedSignals.type_job_affinity = true;
    reasons.push("type_job_affinity");
  }

  const confidence = score <= 0 ? 0 : Math.min(0.98, score / OPPORTUNITY_SCORE_MAX);
  const relevanceScore = Math.round((Math.min(score, OPPORTUNITY_SCORE_MAX) / OPPORTUNITY_SCORE_MAX) * 1000) / 10;

  return { score, reasons, weights, matchedSignals, confidence, relevanceScore };
};

export type RankedOpportunity = OpportunityCandidate & {
  matchScore: number;
  matchReasons: string[];
  matchWeights: Record<string, number>;
  matchedSignals: Record<string, boolean>;
  confidence: number;
  relevanceScore: number;
};

export const rankOpportunities = (
  viewer: MatchProfileInput,
  opps: OpportunityCandidate[],
  limit = 12
): RankedOpportunity[] => {
  return opps
    .map((o) => {
      const b = scoreOpportunity(viewer, o);
      return {
        ...o,
        matchScore: b.score,
        matchReasons: b.reasons,
        matchWeights: b.weights,
        matchedSignals: b.matchedSignals,
        confidence: b.confidence,
        relevanceScore: b.relevanceScore,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
};
