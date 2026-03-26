"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { platformName } from "@/data/landing-content";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getLocale, initLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import PlatformLogo from "@/components/branding/PlatformLogo";
import { ArrowLeft, Menu, X } from "lucide-react";
import HeaderAccountMenu, {
  type HeaderAccountMenuProps,
} from "@/components/layout/HeaderAccountMenu";
import NotificationBell from "@/components/notifications/NotificationBell";

type MainHeaderProps = {
  variant?: "default" | "auth";
  /** Logged-in app shell: show account menu instead of login / انضم الآن */
  userAccount?: HeaderAccountMenuProps;
};

const MainHeader = ({ variant = "default", userAccount }: MainHeaderProps) => {
  useEffect(() => {
    initLocale();
  }, []);

  const locale = getLocale();
  const t = getTranslation(locale);
  const isAuth = variant === "auth";
  const isLoggedIn = Boolean(userAccount);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const publicNav = useMemo(
    () => [
      { href: "/", label: locale === "ar" ? "الرئيسية" : "Home" },
      { href: "/hall-of-fame", label: locale === "ar" ? "لوحة التميز" : "Hall of Fame" },
      {
        href: "/#featured-achievements",
        label: locale === "ar" ? "إنجازات مميّزة" : "Featured Achievements",
      },
      { href: "/contact", label: locale === "ar" ? "اتصل بنا" : "Contact Us" },
    ],
    [locale]
  );

  return (
    <header className="border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[84px] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90"
            aria-label={locale === "ar" ? "العودة إلى الصفحة الرئيسية" : "Back to homepage"}
          >
            <div className="shrink-0 rounded-xl bg-white ring-1 ring-gray-200 p-1">
              <PlatformLogo
                variant="color"
                size={48}
                priority
                alt={locale === "ar" ? "شعار مدارس الأنجال الأهلية" : "AL Anjal Schools Logo"}
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-primary sm:text-xl">
                {locale === "ar" ? platformName.ar : platformName.en}
              </h1>
              {!isAuth && (
                <p className="truncate text-[11px] leading-tight text-text-light sm:text-xs">
                  {platformName.tagline}
                </p>
              )}
            </div>
          </Link>

          {!isAuth && (
            <>
              <nav className="hidden items-center gap-4 lg:flex xl:gap-6">
                {publicNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap text-sm font-medium transition-colors hover:text-primary ${
                      pathname === item.href || (item.href === "/" && pathname === "/")
                        ? "text-primary"
                        : "text-text"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
                <LanguageSwitcher />

                {isLoggedIn && userAccount ? (
                  <>
                    <NotificationBell />
                    <HeaderAccountMenu
                      userName={userAccount.userName}
                      userFullName={userAccount.userFullName}
                      userEmail={userAccount.userEmail}
                      userAvatar={userAccount.userAvatar}
                    />
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="hidden whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
                    >
                      {t.header.login}
                    </Link>

                    <Link
                      href="/register"
                      className="hidden whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark sm:inline-flex"
                    >
                      {t.header.joinNow}
                    </Link>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setMobileOpen((v) => !v)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-text lg:hidden"
                  aria-label={locale === "ar" ? "فتح القائمة" : "Open menu"}
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </>
          )}

          {isAuth && (
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
              >
                <ArrowLeft className={`h-4 w-4 ${locale === "ar" ? "rotate-180" : ""}`} />
                <span className="hidden sm:inline">
                  {locale === "ar" ? "العودة للرئيسية" : "Back to Home"}
                </span>
                <span className="sm:hidden">
                  {locale === "ar" ? "الرئيسية" : "Home"}
                </span>
              </Link>
              <LanguageSwitcher />
            </div>
          )}
        </div>
      </div>
      {!isAuth && mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-3 lg:hidden">
          <nav className="flex flex-col gap-2">
            {isLoggedIn && userAccount?.appHome ? (
              <Link
                href={userAccount.appHome.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
              >
                {userAccount.appHome.label}
              </Link>
            ) : null}
            {publicNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-gray-50 hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
            {!isLoggedIn ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-text"
                >
                  {t.header.login}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                >
                  {t.header.joinNow}
                </Link>
              </div>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
};

export default MainHeader;
