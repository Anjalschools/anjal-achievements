"use client";

import type { ReactNode } from "react";

export type ExecutiveWorkspaceShellProps = {
  children: ReactNode;
  isAr: boolean;
  className?: string;
};

/**
 * Top-level layout shell for the executive intelligence workspace page.
 * Centers content, prevents flex collapse, and avoids viewport-height traps.
 */
const ExecutiveWorkspaceShell = ({ children, isAr, className = "" }: ExecutiveWorkspaceShellProps) => (
  <div
    className={`executive-workspace-root w-full min-w-0 ${className}`.trim()}
    dir={isAr ? "rtl" : "ltr"}
    data-executive-workspace="1"
  >
    <div className="executive-workspace-content mx-auto w-full min-w-0 max-w-[1440px] space-y-4">
      {children}
    </div>
  </div>
);

export default ExecutiveWorkspaceShell;
