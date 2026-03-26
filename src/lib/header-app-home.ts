import type { Locale } from "@/lib/i18n";

/** Link back to the in-app home (dashboard) from the public marketing header account menu. */
export const resolveHeaderAppHome = (
  role: string | undefined,
  locale: Locale
): { href: string; label: string } | undefined => {
  const r = String(role || "").toLowerCase();
  const isAr = locale === "ar";
  if (r === "student") {
    return { href: "/dashboard", label: isAr ? "لوحة التحكم" : "Dashboard" };
  }
  if (["admin", "supervisor", "teacher", "judge", "schooladmin"].includes(r)) {
    return {
      href: "/admin/dashboard",
      label: isAr ? "لوحة الإدارة" : "Admin dashboard",
    };
  }
  return undefined;
};
