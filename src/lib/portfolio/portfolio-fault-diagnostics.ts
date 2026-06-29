import type { PortfolioRequestDiagnostics } from "@/lib/portfolio/portfolio-request-diagnostics";
import { classifyPortfolioException } from "@/lib/portfolio/portfolio-exception-classification";

export type PortfolioFaultScope = "achievement" | "attachment" | "evidence_gallery";

export type PortfolioFaultContext = {
  studentId: string;
  portfolioSlug: string;
  loggedKeys: Set<string>;
  diagnostics?: PortfolioRequestDiagnostics | null;
};

export type PortfolioFaultDetails = {
  achievementId: string;
  achievementTitle?: string | null;
  attachmentIndex?: number | null;
  attachmentName?: string | null;
  attachmentCategory?: string | null;
  phase?: string;
};

export const createPortfolioFaultContext = (input: {
  studentId: string;
  portfolioSlug: string;
  diagnostics?: PortfolioRequestDiagnostics | null;
}): PortfolioFaultContext => ({
  studentId: String(input.studentId || "").trim(),
  portfolioSlug: String(input.portfolioSlug || "").trim().toLowerCase(),
  loggedKeys: new Set<string>(),
  diagnostics: input.diagnostics ?? null,
});

const faultLogKey = (
  scope: PortfolioFaultScope,
  details: PortfolioFaultDetails,
  error: Error
): string =>
  [
    scope,
    details.achievementId || "unknown",
    details.attachmentIndex ?? "na",
    details.phase || "build",
    error.name,
    error.message,
  ].join(":");

export const logPortfolioFault = (
  ctx: PortfolioFaultContext | undefined,
  scope: PortfolioFaultScope,
  error: unknown,
  details: PortfolioFaultDetails
): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  const key = faultLogKey(scope, details, err);

  if (ctx?.loggedKeys.has(key)) return;
  ctx?.loggedKeys.add(key);

  const errorClass = classifyPortfolioException(error);

  const payload: Record<string, unknown> = {
    event: "portfolio_fault_isolated",
    correlationId: ctx?.diagnostics?.correlationId ?? null,
    scope,
    studentId: ctx?.studentId ?? null,
    portfolioSlug: ctx?.portfolioSlug ?? null,
    achievementId: details.achievementId || null,
    achievementTitle: details.achievementTitle ?? null,
    attachmentIndex: details.attachmentIndex ?? null,
    attachmentName: details.attachmentName ?? null,
    attachmentCategory: details.attachmentCategory ?? null,
    phase: details.phase ?? "build",
    errorClass,
    errorName: err.name,
    errorMessage: err.message,
  };

  if (process.env.NODE_ENV !== "production" && err.stack) {
    payload.stackTrace = err.stack;
  }

  console.error("[portfolio-fault]", payload);
};
