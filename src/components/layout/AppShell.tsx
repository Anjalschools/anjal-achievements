"use client";

import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import UnifiedHeader from "./UnifiedHeader";
import UnifiedFooter from "./UnifiedFooter";
import { getLocale } from "@/lib/i18n";

type AppShellProps = {
  children: ReactNode;
  userName?: string;
  userFullName?: string;
  userEmail?: string;
  userAvatar?: string;
};

const AppShell = ({
  children,
  userName,
  userFullName,
  userEmail,
  userAvatar,
}: AppShellProps) => {
  const locale = getLocale();
  const isArabic = locale === "ar";

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-gray-50">
      <UnifiedHeader
        variant="default"
        userAccount={{
          userName,
          userFullName,
          userEmail,
          userAvatar,
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        {/* Single flex child wrapper so sidebar fragment does not create multiple flex items */}
        <div className="shrink-0 overflow-visible lg:w-0 lg:min-w-0">
          <AppSidebar />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div
              className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 ${
                isArabic ? "lg:pr-[280px]" : "lg:pl-[280px]"
              }`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
      <UnifiedFooter />
    </div>
  );
};

export default AppShell;
