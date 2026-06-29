import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyPortfolioException } from "@/lib/portfolio/portfolio-exception-classification";
import {
  createPortfolioDiagnosticsIfEnabled,
  isPortfolioDiagnosticsEnabled,
  PortfolioRequestDiagnostics,
  resolveCorrelationIdFromHeaders,
  resolvePortfolioCorrelationId,
} from "@/lib/portfolio/portfolio-request-diagnostics";

describe("portfolio request diagnostics", () => {
  const originalFlag = process.env.PORTFOLIO_DIAGNOSTICS;

  beforeEach(() => {
    delete process.env.PORTFOLIO_DIAGNOSTICS;
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.PORTFOLIO_DIAGNOSTICS;
    } else {
      process.env.PORTFOLIO_DIAGNOSTICS = originalFlag;
    }
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("enables diagnostics only with flag or development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PORTFOLIO_DIAGNOSTICS", "false");
    expect(isPortfolioDiagnosticsEnabled()).toBe(false);

    vi.stubEnv("PORTFOLIO_DIAGNOSTICS", "true");
    expect(isPortfolioDiagnosticsEnabled()).toBe(true);

    vi.stubEnv("PORTFOLIO_DIAGNOSTICS", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(isPortfolioDiagnosticsEnabled()).toBe(true);
  });

  it("reuses incoming correlation id when provided", () => {
    expect(resolvePortfolioCorrelationId("corr-123")).toBe("corr-123");
    expect(resolvePortfolioCorrelationId("  trace-abc  ")).toBe("trace-abc");
    expect(resolvePortfolioCorrelationId("")).toMatch(/^pf_/);
  });

  it("reads correlation id from request headers", () => {
    const headers = new Headers({
      "x-request-id": "req-42",
    });
    expect(resolveCorrelationIdFromHeaders(headers)).toBe("req-42");
  });

  it("classifies portfolio exceptions", () => {
    expect(classifyPortfolioException(new Error("INVALID_ACHIEVEMENT_ID"))).toBe("ValidationError");
    expect(classifyPortfolioException(new Error("PORTFOLIO_EVIDENCE_SECRET_UNAVAILABLE"))).toBe(
      "ReferenceGenerationError"
    );
    expect(classifyPortfolioException(new Error("missing required field"))).toBe("MissingField");
    expect(classifyPortfolioException(new Error("stream aborted"))).toBe(
      "StreamingPreparationError"
    );
    expect(classifyPortfolioException(new Error("something else"))).toBe("UnknownError");
  });

  it("emits stage logs and summary when enabled", () => {
    vi.stubEnv("PORTFOLIO_DIAGNOSTICS", "true");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const diagnostics =
      createPortfolioDiagnosticsIfEnabled({
        correlationId: "corr-test",
        portfolioSlug: "student-a",
      }) ?? new PortfolioRequestDiagnostics({ correlationId: "corr-test", portfolioSlug: "student-a" });

    diagnostics.setStudentId("507f1f77bcf86cd799439099");
    diagnostics.startStage("LOAD_STUDENT");
    diagnostics.successStage("LOAD_STUDENT");
    diagnostics.logAchievementStart({
      achievementId: "507f1f77bcf86cd799439011",
      achievementTitle: "Sample",
      achievementType: "competition",
      attachmentCount: 2,
      publicAttachmentCount: 1,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    diagnostics.logAchievementFailed("507f1f77bcf86cd799439011", new Error("boom"), {
      achievementTitle: "Sample",
    });
    diagnostics.emitSummary();

    expect(infoSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    const summaryCall = infoSpy.mock.calls.find((call) => {
      const payload = call[1] as { event?: string };
      return payload?.event === "PORTFOLIO_DIAGNOSTIC_SUMMARY";
    });
    expect(summaryCall).toBeTruthy();
    const summary = summaryCall?.[1] as {
      achievementsSkipped: number;
      errors: number;
      correlationId: string;
    };
    expect(summary.correlationId).toBe("corr-test");
    expect(summary.achievementsSkipped).toBe(1);
    expect(summary.errors).toBe(1);

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("creates no diagnostics instance when disabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PORTFOLIO_DIAGNOSTICS", "false");
    expect(
      createPortfolioDiagnosticsIfEnabled({
        correlationId: "corr-test",
        portfolioSlug: "student-a",
      })
    ).toBeNull();
  });

  it("emits summary only once per request", () => {
    vi.stubEnv("PORTFOLIO_DIAGNOSTICS", "true");
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const diagnostics = createPortfolioDiagnosticsIfEnabled({
      correlationId: "corr-once",
      portfolioSlug: "student-a",
    });
    diagnostics?.emitSummary();
    diagnostics?.emitSummary();
    const summaries = infoSpy.mock.calls.filter((call) => {
      const payload = call[1] as { event?: string };
      return payload?.event === "PORTFOLIO_DIAGNOSTIC_SUMMARY";
    });
    expect(summaries).toHaveLength(1);
    infoSpy.mockRestore();
  });
});
