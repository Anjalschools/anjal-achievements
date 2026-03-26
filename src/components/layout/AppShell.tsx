"use client";

import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import UnifiedHeader from "./UnifiedHeader";
import UnifiedFooter from "./UnifiedFooter";
import { getLocale } from "@/lib/i18n";
import { useAppSession } from "@/contexts/AppSessionContext";
import { resolveHeaderAppHome } from "@/lib/header-app-home";

type AppShellProps = {
  children: ReactNode;
};

const AppShell = ({ children }: AppShellProps) => {
  const locale = getLocale();
  const isArabic = locale === "ar";
  const { profile } = useAppSession();

  const userName = profile?.username || "";
  const userFullName = profile?.fullNameAr || profile?.fullName || "";
  const userEmail = profile?.email || "";
  const userAvatar = profile?.profilePhoto;

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-gray-50">
      <UnifiedHeader
        variant="default"
        userAccount={{
          userName,
          userFullName,
          userEmail,
          userAvatar,
          appHome: resolveHeaderAppHome(profile?.role, locale),
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
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
