import type { MatchProfileInput } from "./mentor-matching";

export type OpportunityCandidate = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  company?: string | null;
  location?: string | null;
  featured?: boolean;
};

const norm = (s?: string | null) => (s || "").trim().toLowerCase();

export const scoreOpportunity = (
  viewer: MatchProfileInput,
  opp: OpportunityCandidate
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  let score = 0;
  const hay = norm(`${opp.title} ${opp.description || ""} ${opp.company || ""} ${opp.location || ""}`);

  const vu = norm(viewer.universityName);
  if (vu && hay.includes(vu)) {
    score += 28;
    reasons.push("university_mention");
  }

  const vi = norm(viewer.industry);
  if (vi && (hay.includes(vi) || norm(opp.title).includes(vi))) {
    score += 25;
    reasons.push("industry_match");
  }

  const vm = norm(viewer.major);
  if (vm && hay.includes(vm)) {
    score += 18;
    reasons.push("major_mention");
  }

  const vc = norm(viewer.country) || norm(viewer.studyCountry);
  if (vc && hay.includes(vc)) {
    score += 12;
    reasons.push("location_country");
  }

  for (const t of (viewer.interests || []).map(norm)) {
    if (t.length > 2 && hay.includes(t)) {
      score += 10;
      reasons.push("interest_keyword");
      break;
    }
  }

  if (opp.featured) {
    score += 8;
    reasons.push("featured");
  }

  const cat = norm(viewer.mentorshipCategory);
  if (cat && hay.includes(cat)) {
    score += 8;
    reasons.push("category_match");
  }

  /** Type affinity: internships/jobs for students without strong alumni signals */
  const ty = norm(opp.type);
  if (ty === "internship" || ty === "job") score += 4;

  return { score, reasons };
};

export const rankOpportunities = (
  viewer: MatchProfileInput,
  opps: OpportunityCandidate[],
  limit = 12
): Array<OpportunityCandidate & { matchScore: number; matchReasons: string[] }> => {
  return opps
    .map((o) => {
      const { score, reasons } = scoreOpportunity(viewer, o);
      return { ...o, matchScore: score, matchReasons: reasons };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
};
