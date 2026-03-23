"use client";

import type { ReactNode } from "react";
import UnifiedHeader from "@/components/layout/UnifiedHeader";
import UnifiedFooter from "@/components/layout/UnifiedFooter";

type PublicShellProps = {
  children: ReactNode;
};

/**
 * Unified shell for all public (pre-login) routes: same header/footer as the rest of the site.
 */
const PublicShell = ({ children }: PublicShellProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <UnifiedHeader variant="default" />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <UnifiedFooter />
    </div>
  );
};

export default PublicShell;
