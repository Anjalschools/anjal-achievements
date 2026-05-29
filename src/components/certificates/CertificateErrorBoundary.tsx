"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Link from "next/link";
import SectionCard from "@/components/layout/SectionCard";
import PageContainer from "@/components/layout/PageContainer";

type CertificateErrorBoundaryProps = {
  children: ReactNode;
  achievementId?: string;
  isAr?: boolean;
};

type State = { hasError: boolean; message: string };

class CertificateErrorBoundary extends Component<CertificateErrorBoundaryProps, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Unknown error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[certificate]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isAr = this.props.isAr ?? true;
    const id = this.props.achievementId;

    return (
      <PageContainer className="certificate-page-shell">
        <SectionCard>
          <p className="text-sm font-bold text-red-700">
            {isAr ? "تعذر عرض الشهادة" : "Could not render certificate"}
          </p>
          <p className="mt-2 text-xs text-slate-600">{this.state.message}</p>
          <Link
            href={id ? `/achievements/${id}` : "/achievements"}
            className="mt-4 inline-block text-sm font-semibold text-primary"
          >
            {isAr ? "العودة" : "Back"}
          </Link>
        </SectionCard>
      </PageContainer>
    );
  }
}

export default CertificateErrorBoundary;
