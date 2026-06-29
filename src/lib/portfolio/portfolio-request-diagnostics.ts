import { randomBytes } from "crypto";

import { classifyPortfolioException } from "@/lib/portfolio/portfolio-exception-classification";

export type PortfolioDiagnosticStage =
  | "PORTFOLIO_REQUEST_START"
  | "LOAD_STUDENT"
  | "VALIDATE_TOKEN"
  | "LOAD_ACHIEVEMENTS"
  | "FILTER_PUBLIC_ACHIEVEMENTS"
  | "BUILD_PUBLIC_ACHIEVEMENT"
  | "BUILD_EVIDENCE"
  | "BUILD_SIGNED_REFS"
  | "BUILD_VIEW_MODEL"
  | "RENDER_COMPLETE";

export const isPortfolioDiagnosticsEnabled = (): boolean => {
  if (process.env.NODE_ENV === "development") return true;
  const flag = String(process.env.PORTFOLIO_DIAGNOSTICS || "").trim().toLowerCase();
  return flag === "true" || flag === "1";
};

export const resolvePortfolioCorrelationId = (incoming?: string | null): string => {
  const trimmed = String(incoming || "").trim();
  if (trimmed) return trimmed.slice(0, 128);
  return `pf_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
};

const basePayload = (
  diag: PortfolioRequestDiagnostics,
  event: string,
  extra?: Record<string, unknown>
): Record<string, unknown> => ({
  event,
  correlationId: diag.correlationId,
  portfolioSlug: diag.portfolioSlug,
  studentId: diag.studentId,
  ...extra,
});

export class PortfolioRequestDiagnostics {
  readonly correlationId: string;
  readonly portfolioSlug: string;
  studentId: string | null = null;

  achievementsLoaded = 0;
  achievementsRendered = 0;
  achievementsSkipped = 0;
  attachmentsLoaded = 0;
  attachmentsRendered = 0;
  attachmentsSkipped = 0;
  warnings = 0;
  errors = 0;

  private readonly requestStartedAt = Date.now();
  private readonly stageStartedAt = new Map<PortfolioDiagnosticStage, number>();
  private summaryEmitted = false;

  constructor(input: { correlationId: string; portfolioSlug: string }) {
    this.correlationId = input.correlationId;
    this.portfolioSlug = input.portfolioSlug;
  }

  setStudentId(studentId: string): void {
    this.studentId = String(studentId || "").trim() || null;
  }

  startStage(stage: PortfolioDiagnosticStage): void {
    this.stageStartedAt.set(stage, Date.now());
    console.info("[portfolio-diag]", basePayload(this, "stage_start", { stage }));
  }

  successStage(stage: PortfolioDiagnosticStage): void {
    const startedAt = this.stageStartedAt.get(stage);
    const durationMs = startedAt !== undefined ? Date.now() - startedAt : 0;
    console.info(
      "[portfolio-diag]",
      basePayload(this, "stage_success", { stage, duration_ms: durationMs })
    );
  }

  failedStage(stage: PortfolioDiagnosticStage, error: unknown): void {
    const startedAt = this.stageStartedAt.get(stage);
    const durationMs = startedAt !== undefined ? Date.now() - startedAt : 0;
    const err = error instanceof Error ? error : new Error(String(error));
    const errorClass = classifyPortfolioException(error);
    this.errors += 1;
    const payload: Record<string, unknown> = {
      ...basePayload(this, "stage_failed", {
        stage,
        duration_ms: durationMs,
        errorClass,
        errorName: err.name,
        errorMessage: err.message,
      }),
    };
    if (process.env.NODE_ENV !== "production" && err.stack) {
      payload.stackTrace = err.stack;
    }
    console.error("[portfolio-diag]", payload);
  }

  logAchievementStart(input: {
    achievementId: string;
    achievementTitle: string | null;
    achievementType: string | null;
    attachmentCount: number;
    publicAttachmentCount: number;
    createdAt: string | null;
  }): void {
    console.info(
      "[portfolio-diag]",
      basePayload(this, "achievement_start_build", {
        achievementId: input.achievementId,
        achievementTitle: input.achievementTitle,
        achievementType: input.achievementType,
        attachmentCount: input.attachmentCount,
        publicAttachmentCount: input.publicAttachmentCount,
        createdAt: input.createdAt,
      })
    );
  }

  logAchievementSuccess(achievementId: string, durationMs: number): void {
    this.achievementsRendered += 1;
    console.info(
      "[portfolio-diag]",
      basePayload(this, "achievement_build_success", {
        achievementId,
        duration_ms: durationMs,
      })
    );
  }

  logAchievementFailed(
    achievementId: string,
    error: unknown,
    input?: { achievementTitle?: string | null }
  ): void {
    this.achievementsSkipped += 1;
    this.errors += 1;
    const err = error instanceof Error ? error : new Error(String(error));
    const payload: Record<string, unknown> = {
      ...basePayload(this, "achievement_build_failed", {
        achievementId,
        achievementTitle: input?.achievementTitle ?? null,
        errorClass: classifyPortfolioException(error),
        errorName: err.name,
        errorMessage: err.message,
      }),
    };
    if (process.env.NODE_ENV !== "production" && err.stack) {
      payload.stackTrace = err.stack;
    }
    console.error("[portfolio-diag]", payload);
  }

  logAttachmentStart(input: {
    achievementId: string;
    attachmentIndex: number;
    attachmentName: string;
    mimeType: string;
    evidenceCategory: string | null;
    approved: boolean;
    showInPublicPortfolio: boolean;
  }): void {
    console.info(
      "[portfolio-diag]",
      basePayload(this, "build_attachment_start", {
        achievementId: input.achievementId,
        attachmentIndex: input.attachmentIndex,
        attachmentName: input.attachmentName,
        mimeType: input.mimeType,
        evidenceCategory: input.evidenceCategory,
        approved: input.approved,
        showInPublicPortfolio: input.showInPublicPortfolio,
      })
    );
  }

  logAttachmentSuccess(input: {
    achievementId: string;
    attachmentIndex: number;
    durationMs: number;
  }): void {
    this.attachmentsRendered += 1;
    console.info(
      "[portfolio-diag]",
      basePayload(this, "build_attachment_success", {
        achievementId: input.achievementId,
        attachmentIndex: input.attachmentIndex,
        duration_ms: input.durationMs,
      })
    );
  }

  logAttachmentFailed(input: {
    achievementId: string;
    attachmentIndex: number;
    attachmentName: string;
    error: unknown;
  }): void {
    this.attachmentsSkipped += 1;
    this.errors += 1;
    const err = input.error instanceof Error ? input.error : new Error(String(input.error));
    const payload: Record<string, unknown> = {
      ...basePayload(this, "build_attachment_failed", {
        achievementId: input.achievementId,
        attachmentIndex: input.attachmentIndex,
        attachmentName: input.attachmentName,
        errorClass: classifyPortfolioException(input.error),
        errorName: err.name,
        errorMessage: err.message,
      }),
    };
    if (process.env.NODE_ENV !== "production" && err.stack) {
      payload.stackTrace = err.stack;
    }
    console.error("[portfolio-diag]", payload);
  }

  recordWarning(): void {
    this.warnings += 1;
  }

  emitSummary(): void {
    if (this.summaryEmitted) return;
    this.summaryEmitted = true;
    const durationMs = Date.now() - this.requestStartedAt;
    console.info(
      "[portfolio-diag]",
      basePayload(this, "PORTFOLIO_DIAGNOSTIC_SUMMARY", {
        achievementsLoaded: this.achievementsLoaded,
        achievementsRendered: this.achievementsRendered,
        achievementsSkipped: this.achievementsSkipped,
        attachmentsLoaded: this.attachmentsLoaded,
        attachmentsRendered: this.attachmentsRendered,
        attachmentsSkipped: this.attachmentsSkipped,
        warnings: this.warnings,
        errors: this.errors,
        duration_ms: durationMs,
      })
    );
  }
}

export const createPortfolioDiagnosticsIfEnabled = (input: {
  correlationId?: string | null;
  portfolioSlug: string;
}): PortfolioRequestDiagnostics | null => {
  if (!isPortfolioDiagnosticsEnabled()) return null;
  return new PortfolioRequestDiagnostics({
    correlationId: resolvePortfolioCorrelationId(input.correlationId),
    portfolioSlug: input.portfolioSlug,
  });
};

export const runPortfolioDiagnosticStage = async <T>(
  diagnostics: PortfolioRequestDiagnostics | null | undefined,
  stage: PortfolioDiagnosticStage,
  fn: () => Promise<T> | T
): Promise<T> => {
  if (!diagnostics) return fn();
  diagnostics.startStage(stage);
  try {
    const result = await fn();
    diagnostics.successStage(stage);
    return result;
  } catch (error) {
    diagnostics.failedStage(stage, error);
    throw error;
  }
};

export const resolveCorrelationIdFromHeaders = (
  headers: Headers | { get(name: string): string | null }
): string | undefined => {
  const candidates = ["x-correlation-id", "x-request-id", "x-trace-id"];
  for (const name of candidates) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
};
