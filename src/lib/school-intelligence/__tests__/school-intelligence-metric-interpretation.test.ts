import { describe, expect, it } from "vitest";
import {
  interpretHealthScore,
  interpretIntelligenceScore,
  interpretParticipationRate,
  interpretSsi,
} from "@/lib/school-intelligence/school-intelligence-metric-interpretation";

describe("school-intelligence-metric-interpretation", () => {
  it("interprets health score bands", () => {
    expect(interpretHealthScore(95).labelAr).toBe("ممتاز");
    expect(interpretHealthScore(80).labelEn).toBe("Very good");
    expect(interpretHealthScore(65).labelEn).toBe("Good");
    expect(interpretHealthScore(45).labelAr).toBe("يحتاج تحسين");
    expect(interpretHealthScore(20).labelEn).toBe("Weak");
  });

  it("interprets intelligence score bands", () => {
    expect(interpretIntelligenceScore(92).labelAr).toBe("تحليلات متقدمة جداً");
    expect(interpretIntelligenceScore(55).labelEn).toContain("Insufficient data");
  });

  it("interprets SSI and participation rate", () => {
    expect(interpretSsi(32).labelAr).toBe("متميز");
    expect(interpretSsi(22).labelEn).toBe("High");
    expect(interpretParticipationRate(26).labelAr).toBe("ممتاز");
    expect(interpretParticipationRate(3).labelEn).toBe("Weak");
  });
});
