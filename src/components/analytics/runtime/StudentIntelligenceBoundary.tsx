"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

export type StudentIntelligenceBoundaryProps = {
  children: ReactNode;
  isAr: boolean;
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
};

type BoundaryState = { crashed: boolean };

/**
 * Isolates student-intelligence failures — non-critical module must not crash the workspace.
 */
export class StudentIntelligenceBoundary extends Component<
  StudentIntelligenceBoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { crashed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[student-intelligence-boundary]", error, info.componentStack);
    }
  }

  componentDidUpdate(prev: StudentIntelligenceBoundaryProps) {
    if (prev.error !== this.props.error && !this.props.error) {
      this.setState({ crashed: false });
    }
  }

  render() {
    const { isAr, error, loading, onRetry, children } = this.props;
    const failed = this.state.crashed || Boolean(error);

    if (failed) {
      return (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-950"
          role="alert"
          dir={isAr ? "rtl" : "ltr"}
        >
          <p className="font-black">
            {isAr ? "تعذّر تحميل ذكاء الطلاب" : "Student intelligence unavailable"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            {isAr
              ? "بقية لوحة القرار التنفيذي تعمل بشكل طبيعي. يمكنك إعادة المحاولة أو تخفيف الفلاتر."
              : "The rest of the executive workspace remains available. Retry or relax filters."}
          </p>
          {error ? (
            <p className="mt-2 text-[10px] font-mono text-amber-800/80" dir="ltr">
              {error}
            </p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              {isAr ? "إعادة المحاولة" : "Retry"}
            </button>
          ) : null}
        </div>
      );
    }

    return children;
  }
}

export default StudentIntelligenceBoundary;
