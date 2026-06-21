import { describe, expect, it } from "vitest";
import {
  LOCKED_SCHOOL_INTELLIGENCE_DIAGNOSTICS_FIELDS,
  SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_POLICY,
  SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_VERSION,
  buildSchoolIntelligenceDiagnosticsSchemaMeta,
} from "@/lib/school-intelligence/school-intelligence-diagnostics-schema";

describe("school-intelligence-diagnostics-schema", () => {
  it("freezes diagnostics schema at v10.3.3 with additive-only policy", () => {
    const meta = buildSchoolIntelligenceDiagnosticsSchemaMeta();

    expect(SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_VERSION).toBe("10.3.3");
    expect(SCHOOL_INTELLIGENCE_DIAGNOSTICS_SCHEMA_POLICY).toBe("additive-only");
    expect(meta.schemaVersion).toBe("10.3.3");
    expect(meta.lockedFields).toEqual(LOCKED_SCHOOL_INTELLIGENCE_DIAGNOSTICS_FIELDS);
    expect(meta.lockedFields).toContain("finalReadiness");
    expect(meta.lockedFields).toContain("talentDiscovery");
  });
});
