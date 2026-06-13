/**
 * Admin UI domains — separates achievements platform staff from alumni-only operators and system routes.
 * Client-safe. Route authorization remains in `app-role-scope-matrix` + guards; this module is descriptive routing sugar.
 */
export type AdminDomain = "achievements" | "alumni" | "partnerships" | "system";

export const ADMIN_DOMAIN_LABELS: Record<AdminDomain, { ar: string; en: string }> = {
  achievements: { ar: "منصة التميز والإنجازات", en: "Achievements & excellence" },
  alumni: { ar: "مجتمع الخريجين", en: "Alumni community" },
  partnerships: { ar: "التدريب الصيفي والشراكات", en: "Summer training & partnerships" },
  system: { ar: "النظام والإعدادات العامة", en: "System & global settings" },
};

export const adminDomainForRole = (role: string | null | undefined): AdminDomain | null => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "alumniadmin") return "alumni";
  if (["admin", "supervisor", "schooladmin", "teacher", "judge"].includes(r)) return "achievements";
  return null;
};

/** Best-effort domain from an `/admin/...` pathname (breadcrumbs, analytics, future shell routing). */
export const adminDomainFromPathname = (pathname: string): AdminDomain => {
  const path = pathname.split("?")[0] || "";
  if (path.startsWith("/admin/alumni")) return "alumni";
  if (path.startsWith("/admin/partnerships")) return "partnerships";
  if (
    path.startsWith("/admin/settings") ||
    path.startsWith("/admin/audit-log") ||
    path.startsWith("/admin/access-matrix") ||
    path.startsWith("/admin/users")
  ) {
    return "system";
  }
  return "achievements";
};
