"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  chartId: string;
  isAr: boolean;
  minHeight?: number;
  children: ReactNode;
};

type State = { hasError: boolean };

export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[EXECUTIVE_CHART_RENDER_ERROR]", {
        chartId: this.props.chartId,
        message: error.message,
        componentStack: info.componentStack,
      });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const h = this.props.minHeight ?? 220;
      return (
        <div
          className="flex w-full items-center justify-center rounded-lg border border-dashed border-rose-200 bg-rose-50/80 px-3 text-center text-sm font-semibold text-rose-800"
          style={{ minHeight: h }}
          role="status"
        >
          {this.props.isAr ?
            "تعذّر عرض هذا الرسم"
          : "This chart could not be rendered"}
        </div>
      );
    }
    return this.props.children;
  }
}
