"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export type AnalyticsRenderBoundaryProps = {
  children: ReactNode;
  sectionId: string;
  isAr?: boolean;
  fallback?: ReactNode;
};

type State = { hasError: boolean };

/**
 * Isolates analytics section render errors so one chart block cannot crash the whole page.
 */
export class AnalyticsRenderBoundary extends Component<AnalyticsRenderBoundaryProps, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(`[analytics-section:${this.props.sectionId}]`, error, info.componentStack);
    }
  }

  componentDidUpdate(prevProps: AnalyticsRenderBoundaryProps) {
    if (prevProps.sectionId !== this.props.sectionId) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const isAr = this.props.isAr ?? true;
      return (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-6 text-center text-sm text-amber-950"
          role="alert"
        >
          {isAr
            ? "تعذّر عرض هذا القسم. حدّث الصفحة أو غيّر الفلاتر."
            : "This section could not be rendered. Refresh or adjust filters."}
        </div>
      );
    }
    return this.props.children;
  }
}

export default AnalyticsRenderBoundary;
