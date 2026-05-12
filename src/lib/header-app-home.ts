import type { Locale } from "@/lib/i18n";

const staffRoles = new Set(["admin", "supervisor", "schooladmin", "teacher", "judge"]);

/** Link back to the in-app home from the public marketing header account menu. */
export const resolveHeaderAppHome = (
  role: string | undefined,
  locale: Locale,
  accountType?: string | null
): { href: string; label: string } | undefined => {
  const r = String(role || "").toLowerCase();
  const isAr = locale === "ar";
  if (r === "alumniadmin") {
    return {
      href: "/admin/alumni",
      label: isAr ? "إدارة مجتمع الخريجين" : "Alumni admin",
    };
  }
  if (staffRoles.has(r)) {
    return {
      href: "/admin/dashboard",
      label: isAr ? "لوحة الإدارة" : "Admin dashboard",
    };
  }
  if (String(accountType || "").toLowerCase() === "alumni") {
    return {
      href: "/alumni/dashboard",
      label: isAr ? "لوحة الخريجين" : "Alumni hub",
    };
  }
  if (r === "student") {
    return { href: "/dashboard", label: isAr ? "لوحة التحكم" : "Dashboard" };
  }
  return undefined;
};
