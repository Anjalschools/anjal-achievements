"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSession } from "@/contexts/AppSessionContext";
import { canAccessAdminPath } from "@/lib/app-role-scope-matrix";
import {
  isAdminShellRole,
  isAlumniPlatformAdminRole,
  isPartnershipSupervisorAllowedAdminPath,
  isPartnershipSupervisorRole,
} from "@/lib/achievement-reviewer-roles";

const ALUMNI_ADMIN_HOME = "/admin/alumni";
const PARTNERSHIPS_ADMIN_HOME = "/admin/partnerships";

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
    if (!role || !isAdminShellRole(role)) {
      router.replace("/dashboard");
      return;
    }
    if (isAlumniPlatformAdminRole(role)) {
      const path = pathname.split("?")[0] || "";
      if (!path.startsWith("/admin/alumni")) {
        router.replace(ALUMNI_ADMIN_HOME);
        return;
      }
    }
    if (isPartnershipSupervisorRole(role)) {
      const path = pathname.split("?")[0] || "";
      const authorized = isPartnershipSupervisorAllowedAdminPath(path) && canAccessAdminPath(role, pathname);
      if (!authorized) {
        router.replace(PARTNERSHIPS_ADMIN_HOME);
        return;
      }
    }
    if (!canAccessAdminPath(role, pathname)) {
      if (isAlumniPlatformAdminRole(role)) {
        router.replace(ALUMNI_ADMIN_HOME);
        return;
      }
      if (isPartnershipSupervisorRole(role)) {
        router.replace(PARTNERSHIPS_ADMIN_HOME);
        return;
      }
      router.replace("/admin/dashboard");
    }
  }, [loading, pathname, profile?.role, router]);

  return <>{children}</>;
};

export default AdminAreaGuard;
