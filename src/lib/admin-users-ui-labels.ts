import type { AdminManageableRole } from "@/lib/admin-users-constants";

/** Maps stored roles to Arabic/English admin UI labels (aligned with platform roles). */
export const adminRoleLabel = (role: string, isAr: boolean): string => {
  const m: Record<string, [string, string]> = {
    student: ["طالب", "Student"],
    admin: ["مدير نظام", "Admin"],
    supervisor: ["مشرف", "Supervisor"],
    teacher: ["رائد نشاط", "Activity leader"],
    schoolAdmin: ["مدير مدرسة", "School admin"],
    judge: ["محكم", "Judge"],
  };
  const p = m[role];
  return p ? (isAr ? p[0] : p[1]) : role;
};

export const adminRoleBadgeClass = (role: string): string => {
  const c: Record<string, string> = {
    student: "bg-sky-100 text-sky-900 ring-sky-200",
    admin: "bg-rose-100 text-rose-900 ring-rose-200",
    supervisor: "bg-indigo-100 text-indigo-900 ring-indigo-200",
    teacher: "bg-amber-100 text-amber-950 ring-amber-200",
    schoolAdmin: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    judge: "bg-violet-100 text-violet-900 ring-violet-200",
  };
  return c[role] || "bg-gray-100 text-gray-800 ring-gray-200";
};

export const adminStatusLabel = (status: string, isAr: boolean): string => {
  if (status === "active") return isAr ? "نشط" : "Active";
  if (status === "inactive") return isAr ? "غير نشط" : "Inactive";
  if (status === "suspended") return isAr ? "موقوف" : "Suspended";
  return status;
};

export const adminStatusBadgeClass = (status: string): string => {
  if (status === "active") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (status === "inactive") return "bg-slate-100 text-slate-800 ring-slate-200";
  if (status === "suspended") return "bg-red-100 text-red-900 ring-red-200";
  return "bg-gray-100 text-gray-800 ring-gray-200";
};

export const ROLE_OPTIONS_FOR_FORM: { value: AdminManageableRole; ar: string; en: string }[] = [
  { value: "student", ar: "طالب", en: "Student" },
  { value: "admin", ar: "مدير نظام", en: "Admin" },
  { value: "supervisor", ar: "مشرف", en: "Supervisor" },
  { value: "teacher", ar: "رائد نشاط", en: "Activity leader" },
  { value: "schoolAdmin", ar: "مدير مدرسة", en: "School admin" },
  { value: "judge", ar: "محكم", en: "Judge" },
];
