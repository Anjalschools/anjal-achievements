"use client";

import { useEffect, useMemo, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import {
  ADMIN_ROUTE_REQUIRED_CAPABILITY,
  APP_ROLE_MATRIX,
  ROLE_CAPABILITY_AUDIT_ORDER,
  ROLE_CAPABILITY_LABELS,
  canAccessAdminPath,
  type AppRole,
} from "@/lib/app-role-scope-matrix";
import { Check, Loader2 } from "lucide-react";

type OrganizationalAccessPayload = {
  mode: "full" | "scoped";
  genders?: string[];
  sections?: string[];
  grades?: string[];
} | null;

const STAFF_ROLES_FOR_MATRIX: AppRole[] = [
  "schoolAdmin",
  "teacher",
  "judge",
  "admin",
  "supervisor",
];

const SAMPLE_ADMIN_PATHS = [
  "/admin/dashboard",
  "/admin/achievements/review",
  "/admin/achievements/add",
  "/admin/achievements/reports",
  "/admin/analytics",
  "/admin/users",
  "/admin/settings",
  "/admin/audit-log",
  "/admin/ai/news",
  "/admin/access-matrix",
];

const AccessMatrixPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [orgAccess, setOrgAccess] = useState<OrganizationalAccessPayload>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [permLoading, setPermLoading] = useState(true);
  const [permError, setPermError] = useState<string | null>(null);
  const [permRoles, setPermRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionLabels, setPermissionLabels] = useState<Record<string, { ar: string; en: string }>>({});
  const [permMatrix, setPermMatrix] = useState<Record<string, string[]>>({});
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/user/profile", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) {
          setCurrentRole(null);
          setOrgAccess(null);
          return;
        }
        const data = (await res.json()) as {
          role?: string;
          organizationalAccess?: OrganizationalAccessPayload;
        };
        setCurrentRole(data.role ? String(data.role) : null);
        setOrgAccess(data.organizationalAccess ?? null);
      } catch {
        setCurrentRole(null);
        setOrgAccess(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadPermissions = async () => {
      setPermLoading(true);
      setPermError(null);
      try {
        const res = await fetch("/api/admin/permissions", { cache: "no-store", credentials: "same-origin" });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          roles?: string[];
          permissions?: string[];
          permissionLabels?: Record<string, { ar: string; en: string }>;
          matrix?: Record<string, string[]>;
        };
        if (!res.ok || j.ok === false) {
          setPermError(j.error || (isAr ? "تعذر تحميل مصفوفة RBAC." : "Failed to load RBAC matrix."));
          return;
        }
        setPermRoles(j.roles || []);
        setPermissions(j.permissions || []);
        setPermissionLabels(j.permissionLabels || {});
        setPermMatrix(j.matrix || {});
      } catch {
        setPermError(isAr ? "تعذر تحميل مصفوفة RBAC." : "Failed to load RBAC matrix.");
      } finally {
        setPermLoading(false);
      }
    };
    void loadPermissions();
  }, [isAr]);

  const togglePermission = async (role: string, permission: string) => {
    const key = `${role}:${permission}`;
    if (pendingCell) return;
    setPendingCell(key);
    const prev = permMatrix;
    const currentRolePerms = new Set(prev[role] || []);
    if (currentRolePerms.has(permission)) currentRolePerms.delete(permission);
    else currentRolePerms.add(permission);
    const nextRolePerms = Array.from(currentRolePerms);
    const optimistic = { ...prev, [role]: nextRolePerms };
    setPermMatrix(optimistic);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permissions: nextRolePerms }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; matrix?: Record<string, string[]> };
      if (!res.ok || j.ok === false) {
        setPermMatrix(prev);
        setPermError(j.error || (isAr ? "فشل تحديث الصلاحية." : "Failed to update permission."));
        return;
      }
      if (j.matrix) setPermMatrix(j.matrix);
    } catch {
      setPermMatrix(prev);
      setPermError(isAr ? "فشل تحديث الصلاحية." : "Failed to update permission.");
    } finally {
      setPendingCell(null);
    }
  };

  const scopeDescription = useMemo(() => {
    if (!orgAccess) {
      return isAr ? "لا يوجد نطاق تنظيمي مُعرَّف لهذا الحساب." : "No organizational scope for this account.";
    }
    if (orgAccess.mode === "full") {
      return isAr ? "وصول كامل (مسؤول / مشرف)." : "Full access (platform admin / supervisor).";
    }
    const parts: string[] = [];
    if (orgAccess.genders?.length) {
      const g = orgAccess.genders.map((x) => {
        if (x === "male") return isAr ? "بنين" : "Boys";
        if (x === "female") return isAr ? "بنات" : "Girls";
        return x;
      });
      parts.push(isAr ? `الجنس: ${g.join("، ")}` : `Gender: ${g.join(", ")}`);
    }
    if (orgAccess.sections?.length) {
      const s = orgAccess.sections.map((x) => {
        if (x === "arabic") return isAr ? "عربي" : "Arabic";
        if (x === "international") return isAr ? "دولي" : "International";
        return x;
      });
      parts.push(isAr ? `المسار: ${s.join("، ")}` : `Track: ${s.join(", ")}`);
    }
    if (orgAccess.grades?.length) {
      parts.push(
        isAr
          ? `الصفوف/المراحل: ${orgAccess.grades.join("، ")}`
          : `Grades/stages: ${orgAccess.grades.join(", ")}`
      );
    }
    const body = parts.length ? parts.join(" · ") : isAr ? "نطاق محدد (بدون تفاصيل إضافية)." : "Scoped (no extra dimensions).";
    return body;
  }, [orgAccess, isAr]);

  const routeChecks = useMemo(() => {
    return SAMPLE_ADMIN_PATHS.map((path) => ({
      path,
      allowed: currentRole ? canAccessAdminPath(currentRole, path) : false,
    }));
  }, [currentRole]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-text-light">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مصفوفة الصلاحيات" : "Access matrix"}
        subtitle={
          isAr
            ? "مرجع داخلي: الأدوار، الصلاحيات، ومسارات الإدارة المرتبطة بها."
            : "Internal reference: roles, capabilities, and admin routes."
        }
      />

      <section className="mb-10 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-text">
          {isAr ? "حسابك الحالي" : "Your account"}
        </h2>
        <p className="mt-2 text-sm text-text-light">
          {isAr ? "الدور" : "Role"}:{" "}
          <span className="font-semibold text-text">
            {currentRole
              ? APP_ROLE_MATRIX[currentRole as AppRole]?.[isAr ? "labelAr" : "labelEn"] ?? currentRole
              : "—"}
          </span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-light">{scopeDescription}</p>
      </section>

      <section className="mb-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 font-semibold text-text">
                {isAr ? "الدور" : "Role"}
              </th>
              {ROLE_CAPABILITY_AUDIT_ORDER.map((key) => (
                <th
                  key={key}
                  className="min-w-[7rem] px-2 py-3 text-center text-xs font-semibold text-text-light"
                  title={ROLE_CAPABILITY_LABELS[key][isAr ? "ar" : "en"]}
                >
                  <span className="line-clamp-3">{ROLE_CAPABILITY_LABELS[key][isAr ? "ar" : "en"]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAFF_ROLES_FOR_MATRIX.map((role) => {
              const def = APP_ROLE_MATRIX[role];
              return (
                <tr key={role} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-text">
                    {isAr ? def.labelAr : def.labelEn}
                    <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide text-text-light">
                      {def.scopeMode === "full"
                        ? isAr
                          ? "نطاق كامل"
                          : "Full scope"
                        : isAr
                          ? "نطاق مؤسسي"
                          : "Organizational scope"}
                    </span>
                  </td>
                  {ROLE_CAPABILITY_AUDIT_ORDER.map((key) => (
                    <td key={key} className="px-1 py-2 text-center">
                      <span
                        className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md text-xs font-bold ${
                          def.capabilities[key]
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-gray-100 text-gray-400"
                        }`}
                        aria-label={
                          def.capabilities[key]
                            ? isAr
                              ? "مسموح"
                              : "Allowed"
                            : isAr
                              ? "غير مسموح"
                              : "Denied"
                        }
                      >
                        {def.capabilities[key] ? "✓" : "—"}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-bold text-text">
            {isAr ? "RBAC (صلاحيات ديناميكية)" : "RBAC (dynamic permissions)"}
          </h2>
          <p className="mt-1 text-xs text-text-light">
            {isAr ? "انقر أي خلية لتفعيل/تعطيل الصلاحية مباشرة." : "Click any cell to toggle permission instantly."}
          </p>
        </div>
        {permLoading ? (
          <div className="flex min-h-40 items-center justify-center text-text-light">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : permError ? (
          <p className="p-4 text-sm text-rose-600">{permError}</p>
        ) : (
          <table className="min-w-[960px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 font-semibold text-text">
                  {isAr ? "الدور" : "Role"}
                </th>
                {permissions.map((perm) => (
                  <th key={perm} className="min-w-[7rem] px-2 py-3 text-center text-xs font-semibold text-text-light" title={permissionLabels[perm]?.[isAr ? "ar" : "en"] || perm}>
                    <span className="line-clamp-3">{permissionLabels[perm]?.[isAr ? "ar" : "en"] || perm}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permRoles.map((role) => (
                <tr key={role} className="border-b border-gray-100 hover:bg-gray-50/70">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-text">
                    {APP_ROLE_MATRIX[role as AppRole]?.[isAr ? "labelAr" : "labelEn"] || role}
                  </td>
                  {permissions.map((perm) => {
                    const cellKey = `${role}:${perm}`;
                    const on = (permMatrix[role] || []).includes(perm);
                    const isSaving = pendingCell === cellKey;
                    return (
                      <td key={perm} className="px-1 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => void togglePermission(role, perm)}
                          disabled={isSaving || pendingCell !== null}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs ${
                            on
                              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                              : "border-gray-300 bg-white text-gray-400"
                          }`}
                          aria-label={`${role} ${perm}`}
                        >
                          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? <Check className="h-3.5 w-3.5" /> : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-10 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-bold text-text">
          {isAr ? "مسارات الإدارة والقدرة المطلوبة" : "Admin routes & required capability"}
        </h2>
        <ul className="space-y-2 text-sm">
          {[...ADMIN_ROUTE_REQUIRED_CAPABILITY]
            .sort((a, b) => b.prefix.length - a.prefix.length)
            .map((row) => (
              <li
                key={row.prefix}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-text"
              >
                <span>{row.prefix}</span>
                <span className="text-text-light">
                  → {ROLE_CAPABILITY_LABELS[row.capability][isAr ? "ar" : "en"]}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-dashed border-gray-300 bg-amber-50/60 p-4 sm:p-6">
        <h2 className="mb-3 text-lg font-bold text-text">
          {isAr ? "فحص سريع للمسارات (حسابك)" : "Quick path check (your account)"}
        </h2>
        <ul className="space-y-2 text-sm">
          {routeChecks.map((r) => (
            <li
              key={r.path}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 font-mono text-xs shadow-sm"
            >
              <span>{r.path}</span>
              <span
                className={
                  r.allowed ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"
                }
              >
                {r.allowed ? (isAr ? "مسموح" : "Allowed") : isAr ? "غير مسموح" : "Blocked"}
              </span>
            </li>
          ))}
        </ul>
        {process.env.NODE_ENV === "development" ? (
          <p className="mt-4 text-xs text-text-light">
            [dev] Sidebar + AdminAreaGuard + API يجب أن تتطابق مع هذه المصفوفة.
          </p>
        ) : null}
      </section>
    </PageContainer>
  );
};

export default AccessMatrixPage;
