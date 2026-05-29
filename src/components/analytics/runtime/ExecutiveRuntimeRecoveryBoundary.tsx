"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ExecutiveErrorCard } from "@/components/analytics/ExecutiveErrorCard";
import { recordExecFacetRetry } from "@/lib/analytics/runtime/runtime-health-registry";
import { resetChartWatchdog } from "@/lib/analytics/runtime/chart-watchdog";

export type ExecutiveRuntimeRecoveryBoundaryProps = {
  isAr: boolean;
  sectionId: string;
  children: ReactNode;
  onSoftReset?: () => void;
  onFacetRetry?: () => void;
};

type State = {
  error: Error | null;
  correlationId: string | null;
};

export class ExecutiveRuntimeRecoveryBoundary extends Component<
  ExecutiveRuntimeRecoveryBoundaryProps,
  State
> {
  state: State = { error: null, correlationId: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      error,
      correlationId: `err-${Date.now()}`,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[EXEC_RUNTIME_RECOVERY]", {
        section: this.props.sectionId,
        error: error.message,
        componentStack: info.componentStack,
      });
    }
  }

  handleRetry = (): void => {
    recordExecFacetRetry(this.props.sectionId);
    resetChartWatchdog();
    this.props.onFacetRetry?.();
    this.setState({ error: null, correlationId: null });
  };

  handleSoftReset = (): void => {
    resetChartWatchdog();
    this.props.onSoftReset?.();
    this.setState({ error: null, correlationId: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ExecutiveErrorCard
          isAr={this.props.isAr}
          correlationId={this.state.correlationId}
          message={
            this.props.isAr
              ? "حدث خطأ في وقت التشغيل. يمكنك إعادة المحاولة دون إعادة تحميل الصفحة."
              : "A runtime error occurred. You can retry without reloading the page."
          }
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
