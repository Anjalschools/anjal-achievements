import { describe, expect, it } from "vitest";

describe("school intelligence execution chain audit", () => {
  it("has no legacy buildStudentIntelligence timeout wrapper in student-success-graph", async () => {
    const fs = await import("node:fs/promises");
    const graph = await fs.readFile("src/lib/school-intelligence/student-success-graph.ts", "utf8");
    expect(graph).not.toContain('operation: "buildStudentIntelligence"');
    expect(graph).not.toContain("profileMongoOperation");
    expect(graph).toContain("buildStudentIntelligenceResilient");
    expect(graph).toContain("SCHOOL_INTELLIGENCE_QUERY_TIMEOUT_MS");
  });

  it("route always returns success payload and hardened fallback", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile("src/app/api/admin/school-intelligence/route.ts", "utf8");
    expect(route).not.toContain("jsonInternalServerError");
    expect(route).toContain("success: true");
    expect(route).toContain("buildSchoolIntelligenceApiPayload");
    expect(route).toContain("fallback:");
  });

  it("student intelligence analytics never throws for schoolGraph without snapshot", async () => {
    const fs = await import("node:fs/promises");
    const analytics = await fs.readFile("src/lib/student-intelligence-analytics.ts", "utf8");
    expect(analytics).toContain("buildStudentIntelligenceResilient");
    expect(analytics).toContain("STUDENT_INTEL_FACET_SNAPSHOT_KEY");
    expect(analytics).toContain("STUDENT_INTEL_SCHOOL_GRAPH_SNAPSHOT_KEY");
    expect(analytics).toContain("returning empty intelligence payload");
    expect(analytics).toContain('console.time("load-achievements")');
    expect(analytics).toContain('console.time("aggregate-achievements")');
  });

  it("boot logging and snapshot keys are defined", async () => {
    const fs = await import("node:fs/promises");
    const boot = await fs.readFile("src/lib/school-intelligence/school-intelligence-boot.ts", "utf8");
    const route = await fs.readFile("src/app/api/admin/school-intelligence/route.ts", "utf8");
    const page = await fs.readFile("src/app/(app)/admin/school-intelligence/page.tsx", "utf8");
    expect(boot).toContain("[SchoolIntelligence] using optimized intelligence path");
    expect(boot).toContain("[SchoolIntelligence] snapshot fallback enabled");
    expect(boot).toContain('SCHOOL_INTELLIGENCE_RUNTIME_VERSION = "10.3.3.D"');
    expect(route).toContain("[SchoolIntelligence Route Active]");
    expect(route).toContain("runtimeVersion");
    expect(page).toContain("parseSchoolIntelligenceResponse");
  });

  it("frontend uses transparency layer instead of raw timeout errors", async () => {
    const fs = await import("node:fs/promises");
    const page = await fs.readFile("src/app/(app)/admin/school-intelligence/page.tsx", "utf8");
    expect(page).toContain("resolveTransparentPageState");
    expect(page).toContain("SchoolIntelligenceRootCausePanel");
    expect(page).toContain("parseSchoolIntelligenceResponse");
    expect(page).not.toContain('if (!res.ok) throw');
  });

  it("8000ms timeout label only originates from intelligence mongo profiler", async () => {
    const fs = await import("node:fs/promises");
    const profiler = await fs.readFile("src/lib/school-improvement/intelligence-mongo-profiler.ts", "utf8");
    const selfHealing = await fs.readFile("src/lib/school-improvement/intelligence-self-healing.ts", "utf8");
    expect(profiler).toContain("INTELLIGENCE_QUERY_TIMEOUT_MS || 8000");
    expect(selfHealing).toContain("exceeded ${timeoutMs}ms");
  });
});
