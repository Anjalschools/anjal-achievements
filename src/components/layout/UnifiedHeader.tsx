"use client";

import TopUtilityBar from "@/components/landing/TopUtilityBar";
import MainHeader from "@/components/landing/MainHeader";
import type { HeaderAccountMenuProps } from "./HeaderAccountMenu";
import { useAppSessionOptional } from "@/contexts/AppSessionContext";
import { getLocale } from "@/lib/i18n";
import { resolveHeaderAppHome } from "@/lib/header-app-home";

export type UnifiedHeaderProps = {
  variant?: "default" | "auth";
  /** App shell can pass account explicitly; on public routes, session is read from shared context. */
  userAccount?: HeaderAccountMenuProps;
};

const profileToHeaderAccount = (p: {
  username?: string;
  fullNameAr?: string;
  fullName?: string;
  email?: string;
  profilePhoto?: string;
}): HeaderAccountMenuProps => ({
  userName: p.username || "",
  userFullName: p.fullNameAr || p.fullName || "",
  userEmail: p.email || "",
  userAvatar: p.profilePhoto,
});

/**
 * Single source of truth for the marketing header: dark utility strip + white main header.
 * Logged-in users keep the account menu on public pages via AppSessionProvider (root).
 */
const UnifiedHeader = ({ variant = "default", userAccount: userAccountProp }: UnifiedHeaderProps) => {
  const session = useAppSessionOptional();
  const locale = getLocale();
  const mergedAccount = (() => {
    const fromSessionAppHome =
      session?.profile?.id ? resolveHeaderAppHome(session.profile.role, locale) : undefined;
    if (userAccountProp) {
      if (userAccountProp.appHome !== undefined) return userAccountProp;
      return { ...userAccountProp, appHome: fromSessionAppHome };
    }
    if (session?.profile?.id) {
      return {
        ...profileToHeaderAccount(session.profile),
        appHome: fromSessionAppHome,
      };
    }
    return undefined;
  })();

  return (
    <div className="sticky top-0 z-50">
      <TopUtilityBar />
      <MainHeader variant={variant} userAccount={mergedAccount} />
    </div>
  );
};

export default UnifiedHeader;
