"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppSessionOptional } from "@/contexts/AppSessionContext";
import { requireAuthRedirect } from "@/lib/requireAuthRedirect";

export const useRequireAuthRedirect = () => {
  const router = useRouter();
  const session = useAppSessionOptional();
  const isLoggedIn = Boolean(session?.profile?.id);
  const loading = session?.loading ?? true;

  const pushWithAuth = useCallback(
    (targetPath: string) => {
      if (loading) return;
      requireAuthRedirect((url) => router.push(url), isLoggedIn, targetPath);
    },
    [router, isLoggedIn, loading]
  );

  return { pushWithAuth, isLoggedIn, loading };
};
