"use client";

import TopUtilityBar from "@/components/landing/TopUtilityBar";
import MainHeader from "@/components/landing/MainHeader";
import type { HeaderAccountMenuProps } from "./HeaderAccountMenu";

export type UnifiedHeaderProps = {
  variant?: "default" | "auth";
  /** When provided (app area), main header shows account menu instead of login/register */
  userAccount?: HeaderAccountMenuProps;
};

/**
 * Single source of truth for the marketing header: dark utility strip + white main header.
 */
const UnifiedHeader = ({ variant = "default", userAccount }: UnifiedHeaderProps) => {
  return (
    <div className="sticky top-0 z-50">
      <TopUtilityBar />
      <MainHeader variant={variant} userAccount={userAccount} />
    </div>
  );
};

export default UnifiedHeader;
