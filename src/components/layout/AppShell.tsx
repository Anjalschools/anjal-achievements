"use client";

import { ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AppSidebar from "./AppSidebar";
import UnifiedHeader from "./UnifiedHeader";
import UnifiedFooter from "./UnifiedFooter";
import { defaultLocale, getLocale } from "@/lib/i18n";
import { useAppSession } from "@/contexts/AppSessionContext";
import { UnreadNotificationProvider } from "@/contexts/UnreadNotificationContext";
import { useClientMounted } from "@/hooks/useClientMounted";
import { resolveHeaderAppHome } from "@/lib/header-app-home";

type AppShellProps = {
  children: ReactNode;
};

const AppShell = ({ children }: AppShellProps) => {
  const mounted = useClientMounted();
  const locale = mounted ? getLocale() : defaultLocale;
  const isArabic = locale === "ar";
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading: sessionLoading } = useAppSession();

  const userName = profile?.username || "";
  const userFullName = profile?.fullNameAr || profile?.fullName || "";
  const userEmail = profile?.email || "";
  const userAvatar = profile?.profilePhoto;

  useEffect(() => {
    if (sessionLoading) return;
    if (!profile?.needsAlumniOnboarding) return;
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;
    if (pathname.startsWith("/alumni/onboarding")) return;
    if (pathname.startsWith("/alumni/")) {
      router.replace("/alumni/onboarding");
    }
  }, [sessionLoading, profile?.needsAlumniOnboarding, pathname, router]);

  const showAlumniOnboardingBanner =
    profile?.needsAlumniOnboarding === true &&
    pathname &&
    !pathname.startsWith("/alumni/onboarding") &&
    !pathname.startsWith("/admin");

  return (
    <UnreadNotificationProvider>
    <div className="flex min-h-screen min-w-0 flex-col bg-gray-50">
      <UnifiedHeader
        variant="default"
        userAccount={{
          userName,
          userFullName,
          userEmail,
          userAvatar,
          appHome: resolveHeaderAppHome(profile?.role, locale, profile?.accountType),
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
              {showAlumniOnboardingBanner ? (
                <div
                  className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
                  role="status"
                  dir={isArabic ? "rtl" : "ltr"}
                >
                  <p className="font-bold">
                    {isArabic
                      ? "أكمل بيانات الخريج لمواصلة استخدام خدمات مجتمع الخريجين."
                      : "Complete your alumni profile to continue using alumni community features."}
                  </p>
                  <Link
                    href="/alumni/onboarding"
                    className="mt-2 inline-block font-semibold text-primary underline"
                  >
                    {isArabic ? "متابعة الاستكمال الآن" : "Continue onboarding"}
                  </Link>
                </div>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>
      <UnifiedFooter />
    </div>
    </UnreadNotificationProvider>
  );
};

export default AppShell;
