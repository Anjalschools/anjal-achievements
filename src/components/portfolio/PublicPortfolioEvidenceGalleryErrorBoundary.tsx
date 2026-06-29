"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  achievementId?: string;
  children: ReactNode;
};

type State = { hasError: boolean };

export class PublicPortfolioEvidenceGalleryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const payload: Record<string, unknown> = {
      event: "portfolio_fault_isolated",
      scope: "evidence_gallery",
      achievementId: this.props.achievementId ?? null,
      errorName: error.name,
      errorMessage: error.message,
      phase: "client_render",
    };
    if (process.env.NODE_ENV !== "production" && info.componentStack) {
      payload.componentStack = info.componentStack;
    }
    console.error("[portfolio-fault]", payload);
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
