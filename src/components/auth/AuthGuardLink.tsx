"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useRequireAuthRedirect } from "@/hooks/useRequireAuthRedirect";

type LinkProps = ComponentProps<typeof Link>;

export type AuthGuardLinkProps = Omit<LinkProps, "onClick" | "onKeyDown"> & {
  href: string;
  onClick?: LinkProps["onClick"];
  onKeyDown?: LinkProps["onKeyDown"];
};

/**
 * Intercepts navigation: guests → `/login?callbackUrl=…`, signed-in → `href`.
 * Preserves `href` for crawlers / copy-link; primary navigation uses onClick.
 */
const AuthGuardLink = ({
  href,
  children,
  className,
  prefetch = false,
  onClick,
  onKeyDown,
  ...rest
}: AuthGuardLinkProps) => {
  const { pushWithAuth, loading } = useRequireAuthRedirect();

  const handleNavigate = () => {
    pushWithAuth(href);
  };

  return (
    <Link
      {...rest}
      href={href}
      prefetch={prefetch}
      className={[className, loading ? "cursor-wait opacity-90" : ""].filter(Boolean).join(" ")}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
        handleNavigate();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") {
          onKeyDown?.(e);
          return;
        }
        e.preventDefault();
        onKeyDown?.(e);
        handleNavigate();
      }}
    >
      {children}
    </Link>
  );
};

export default AuthGuardLink;
