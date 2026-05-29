"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  section: string;
  isAr: boolean;
  onRetry?: () => void;
  children: ReactNode;
};

type State = { hasError: boolean };

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[FOCUSED_SECTION_RENDER]", {
        section: this.props.section,
        status: "error",
        message: error.message,
        componentStack: info.componentStack,
      });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[FOCUSED_SECTION_RETRY]", { section: this.props.section, source: "boundary" });
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-900">
        <p className="font-black">
          {this.props.isAr ? "تعذّر تحميل هذا القسم" : "This section failed to render"}
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100"
        >
          {this.props.isAr ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    );
  }
}

