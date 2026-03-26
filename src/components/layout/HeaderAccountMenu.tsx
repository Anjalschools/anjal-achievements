"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, User, Settings, ChevronDown, Bell, LayoutDashboard } from "lucide-react";
import { getLocale } from "@/lib/i18n";

export type HeaderAccountMenuProps = {
  userName?: string;
  userFullName?: string;
  userEmail?: string;
  userAvatar?: string;
  /** لوحة التحكم / العودة للمنطقة الداخلية بعد تصفح الصفحات العامة */
  appHome?: { href: string; label: string };
};

const HeaderAccountMenu = ({
  userName,
  userFullName,
  userEmail,
  userAvatar,
  appHome,
}: HeaderAccountMenuProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const locale = getLocale();

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = userFullName || userName || (locale === "ar" ? "المستخدم" : "User");
  const trimmedAvatar = userAvatar?.trim() ?? "";
  const showAvatar =
    Boolean(trimmedAvatar) &&
    !avatarFailed &&
    (trimmedAvatar.startsWith("/") ||
      trimmedAvatar.startsWith("data:") ||
      trimmedAvatar.startsWith("http://") ||
      trimmedAvatar.startsWith("https://"));
  const avatarUnoptimized =
    trimmedAvatar.startsWith("data:") ||
    trimmedAvatar.startsWith("http://") ||
    trimmedAvatar.startsWith("https://");

  useEffect(() => {
    setAvatarFailed(false);
  }, [userAvatar]);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex max-w-[220px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-gray-50 sm:gap-3 sm:px-3 sm:py-2"
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        <div className="flex min-w-0 items-center gap-2">
          {showAvatar ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-gray-200">
              <Image
                src={trimmedAvatar}
                alt={userName || "User"}
                fill
                unoptimized={avatarUnoptimized}
                className="object-cover"
                onError={() => setAvatarFailed(true)}
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {getInitials(displayName)}
            </div>
          )}
          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-medium text-text">{displayName}</p>
            {userEmail ? (
              <p className="truncate text-xs text-text-light">{userEmail}</p>
            ) : null}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-light transition-transform ${
            isMenuOpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {isMenuOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} aria-hidden />
          <div className="absolute end-0 top-full z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-2">
              {appHome ? (
                <>
                  <Link
                    href={appHome.href}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{appHome.label}</span>
                  </Link>
                  <div className="my-1.5 border-t border-gray-100" aria-hidden />
                </>
              ) : null}
              <Link
                href="/notifications"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-gray-100"
              >
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
                <span>{locale === "ar" ? "الإشعارات" : "Notifications"}</span>
              </Link>
              <Link
                href="/profile"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-gray-100"
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span>{locale === "ar" ? "الملف الشخصي" : "Profile"}</span>
              </Link>
              <Link
                href="/settings"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-gray-100"
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden />
                <span>{locale === "ar" ? "الإعدادات" : "Settings"}</span>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  void handleLogout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                <span>{locale === "ar" ? "تسجيل الخروج" : "Logout"}</span>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default HeaderAccountMenu;
