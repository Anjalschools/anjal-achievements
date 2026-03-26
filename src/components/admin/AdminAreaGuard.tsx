"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSession } from "@/contexts/AppSessionContext";
import { canAccessAdminPath } from "@/lib/app-role-scope-matrix";
import { isAchievementReviewerRole } from "@/lib/achievement-reviewer-roles";

/**
 * Redirects away from /admin routes the current role cannot access (RBAC + route matrix).
 */
const AdminAreaGuard = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading } = useAppSession();

  useEffect(() => {
    if (loading) return;
    const role = profile?.role;
    if (!pathname?.startsWith("/admin")) return;
    if (!role || !isAchievementReviewerRole(role)) {
      router.replace("/dashboard");
      return;
    }
    if (!canAccessAdminPath(role, pathname)) {
      router.replace("/admin/dashboard");
    }
  }, [loading, pathname, profile?.role, router]);

  return <>{children}</>;
};

export default AdminAreaGuard;
