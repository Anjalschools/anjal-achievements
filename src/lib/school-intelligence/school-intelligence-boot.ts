let bootLogged = false;

export const SCHOOL_INTELLIGENCE_RUNTIME_VERSION = "10.3.3.D";

export const SCHOOL_INTEL_FACET_SNAPSHOT_KEY = "student_intelligence_facet";
export const SCHOOL_INTEL_SCHOOL_GRAPH_SNAPSHOT_KEY = "student_intelligence_school_graph";
export const SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY = "school_intelligence_payload";

export const SCHOOL_INTELLIGENCE_QUERY_TIMEOUT_MS = Number(
  process.env.SCHOOL_INTELLIGENCE_QUERY_TIMEOUT_MS || 30_000
);

export const SCHOOL_INTELLIGENCE_AGG_TIMEOUT_MS = Number(
  process.env.SCHOOL_INTELLIGENCE_AGG_TIMEOUT_MS || 60_000
);

export const logSchoolIntelligenceBoot = () => {
  if (bootLogged) return;
  bootLogged = true;
  console.log("[SchoolIntelligence] using optimized intelligence path");
  console.log("[SchoolIntelligence] snapshot fallback enabled");
};
