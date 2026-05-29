"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export type HistoricalTableRenderBoundaryProps = {
  children: ReactNode;
  tableId: string;
  isAr?: boolean;
};

type State = { hasError: boolean };

export class HistoricalTableRenderBoundary extends Component<
  HistoricalTableRenderBoundaryProps,
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(`[historical-table:${this.props.tableId}]`, error, info.componentStack);
    }
  }

  componentDidUpdate(prev: HistoricalTableRenderBoundaryProps) {
    if (prev.tableId !== this.props.tableId) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      const isAr = this.props.isAr ?? true;
      return (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-5 text-center text-xs text-amber-950"
          role="alert"
        >
          {isAr
            ? "تعذّر عرض هذا الجدول التاريخي. جرّب تحديث البيانات أو توسيع نطاق السنوات."
            : "This historical table could not be rendered. Try refreshing or widening the year range."}
        </div>
      );
    }
    return this.props.children;
  }
}

export default HistoricalTableRenderBoundary;
