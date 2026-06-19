import type { IntelligenceServiceDomain } from "@/models/IntelligenceSectionSnapshot";

export const INTELLIGENCE_SECTION_DOMAIN: Record<string, IntelligenceServiceDomain> = {
  school_intelligence_network: "school_improvement",
  student_success_graph: "school_improvement",
  action_engine: "school_improvement",
  improvement_plans: "school_improvement",
  opportunity_recommendations: "school_improvement",
  student_action_lists: "school_improvement",
  department_action_plans: "school_improvement",
  institution_expansion: "school_improvement",
  predictive_scenarios: "executive_intelligence",
  strategic_roadmap: "executive_intelligence",
  improvement_tracking: "school_improvement",
  partnership_indicators: "partnership_intelligence",
  summary: "school_improvement",
  build: "school_improvement",
};

export const resolveIntelligenceDomain = (section: string): IntelligenceServiceDomain =>
  INTELLIGENCE_SECTION_DOMAIN[section] || "school_improvement";

export const QUERY_DOMAIN_BY_COLLECTION: Record<string, IntelligenceServiceDomain> = {
  Achievement: "achievement_intelligence",
  User: "achievement_intelligence",
  StudentCareerProfile: "achievement_intelligence",
  TrainingCompletionRecord: "partnership_intelligence",
  PartnerOrganization: "partnership_intelligence",
  TrainingOpportunity: "partnership_intelligence",
};

export const resolveQueryDomain = (collection: string): IntelligenceServiceDomain =>
  QUERY_DOMAIN_BY_COLLECTION[collection] || "school_improvement";
