"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import type { AdminUserListRow } from "@/lib/admin-users-serialize";
import type { AdminUserStats } from "@/lib/admin-users-service";
import {
  adminRoleBadgeClass,
  adminRoleLabel,
  adminStatusBadgeClass,
  adminStatusLabel,
} from "@/lib/admin-users-ui-labels";
import { ADMIN_MANAGEABLE_ROLES } from "@/lib/admin-users-constants";
import { AdminUserPasswordDialog } from "@/components/admin/users/AdminUserPasswordDialog";
import {
  MoreVertical,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";

type ListResponse = {
  items: AdminUserListRow[];
  total: number;
  page: number;
  limit: number;
  stats: AdminUserStats;
};

const fmtDate = (iso: string | null, isAr: boolean) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const AdminUsersPageInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = getLocale();
  const isAr = locale === "ar";

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse | null>(null);

  const [qInput, setQInput] = useState(searchParams.get("q") || "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLTableCellElement>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwUser, setPwUser] = useState<AdminUserListRow | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminUserListRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(null);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const j = await res.json();
        const role = String(j.role || "");
        setAllowed(role === "admin");
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const pushQuery = useCallback(
    (next: { q?: string; role?: string; status?: string; page?: number }) => {
      const p = new URLSearchParams();
      const q = next.q ?? qInput.trim();
      const role = next.role ?? roleFilter;
      const status = next.status ?? statusFilter;
      const pg = next.page ?? page;
      if (q) p.set("q", q);
      if (role && role !== "all") p.set("role", role);
      if (status && status !== "all") p.set("status", status);
      if (pg > 1) p.set("page", String(pg));
      router.replace(`/admin/users${p.toString() ? `?${p}` : ""}`);
    },
    [qInput, roleFilter, statusFilter, page, router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      const q = searchParams.get("q")?.trim() || "";
      const role = searchParams.get("role") || "all";
      const status = searchParams.get("status") || "all";
      const pg = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
      if (q) p.set("q", q);
      if (role !== "all") p.set("role", role);
      if (status !== "all") p.set("status", status);
      p.set("page", String(pg));
      p.set("limit", "20");

      const res = await fetch(`/api/admin/users?${p}`, { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      const j = (await res.json()) as ListResponse & { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (allowed !== true) return;
    void load();
  }, [allowed, load]);

  useEffect(() => {
    setQInput(searchParams.get("q") || "");
    setRoleFilter(searchParams.get("role") || "all");
    setStatusFilter(searchParams.get("status") || "all");
  }, [searchParams]);

  const stats = data?.stats;

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { labelAr: "إجمالي المستخدمين", labelEn: "Total users", value: stats.totalUsers, tone: "slate" },
      { labelAr: "الطلاب", labelEn: "Students", value: stats.students, tone: "sky" },
      { labelAr: "المحكمون", labelEn: "Judges", value: stats.judges, tone: "violet" },
      { labelAr: "رواد النشاط", labelEn: "Activity leaders", value: stats.teachers, tone: "amber" },
      { labelAr: "مديرو المدارس", labelEn: "School admins", value: stats.schoolAdmins, tone: "emerald" },
      { labelAr: "المديرون", labelEn: "Admins", value: stats.admins, tone: "rose" },
      { labelAr: "المشرفون", labelEn: "Supervisors", value: stats.supervisors, tone: "indigo" },
      { labelAr: "حسابات نشطة", labelEn: "Active", value: stats.active, tone: "emerald" },
      { labelAr: "موقوفة / غير نشطة", labelEn: "Inactive + suspended", value: stats.inactive + stats.suspended, tone: "orange" },
    ];
  }, [stats]);

  const toneCard: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50",
    sky: "border-sky-200 bg-sky-50",
    violet: "border-violet-200 bg-violet-50",
    amber: "border-amber-200 bg-amber-50",
    emerald: "border-emerald-200 bg-emerald-50",
    rose: "border-rose-200 bg-rose-50",
    indigo: "border-indigo-200 bg-indigo-50",
    orange: "border-orange-200 bg-orange-50",
  };

  const handleApplyFilters = () => {
    pushQuery({ q: qInput.trim(), role: roleFilter, status: statusFilter, page: 1 });
  };

  const toggleStatus = async (row: AdminUserListRow) => {
    setMenuOpen(null);
    const next = row.status === "active" ? "suspended" : "active";
    try {
      const res = await fetch(`/api/admin/users/${row.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setToast(isAr ? "تم تحديث الحالة" : "Status updated");
      setTimeout(() => setToast(null), 2500);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setDeleteTarget(null);
      setToast(isAr ? "تم حذف المستخدم" : "User deleted");
      setTimeout(() => setToast(null), 2500);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700" dir={isAr ? "rtl" : "ltr"}>
          {isAr ? "غير مصرح لك بإدارة المستخدمين." : "You are not allowed to manage users."}
        </p>
      </PageContainer>
    );
  }

  if (allowed === null) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24 text-text-light">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      </PageContainer>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <PageContainer>
      <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={isAr ? "إدارة المستخدمين" : "User management"}
          subtitle={
            isAr
              ? "إدارة الحسابات والصلاحيات وحالة التفعيل"
              : "Manage accounts, roles, and activation state"
          }
          actions={
            <Link
              href="/admin/users/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              {isAr ? "إنشاء مستخدم" : "Create user"}
            </Link>
          }
        />

        {toast ? (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900"
          >
            {toast}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        {stats ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {statCards.map((c) => (
              <div
                key={c.labelEn}
                className={`rounded-2xl border p-4 shadow-sm ${toneCard[c.tone] || toneCard.slate}`}
              >
                <p className="text-xs font-bold text-text/80">{isAr ? c.labelAr : c.labelEn}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-text">{c.value}</p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <label className="min-w-[200px] flex-1 text-xs font-semibold text-text-light">
              {isAr ? "بحث" : "Search"}
              <span className="mt-1 flex rounded-xl border border-gray-200 bg-gray-50">
                <Search className="m-2 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <input
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                  placeholder={isAr ? "اسم، بريد، مستخدم، رقم…" : "Name, email, username, ID…"}
                  className="w-full bg-transparent py-2 pe-3 text-sm outline-none"
                />
              </span>
            </label>
            <label className="min-w-[140px] text-xs font-semibold text-text-light">
              {isAr ? "الدور" : "Role"}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                {ADMIN_MANAGEABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {adminRoleLabel(r, isAr)}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[140px] text-xs font-semibold text-text-light">
              {isAr ? "الحالة" : "Status"}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="active">{isAr ? "نشط" : "Active"}</option>
                <option value="inactive">{isAr ? "غير نشط" : "Inactive"}</option>
                <option value="suspended">{isAr ? "موقوف" : "Suspended"}</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                {isAr ? "تطبيق" : "Apply"}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-text hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                {isAr ? "تحديث" : "Refresh"}
              </button>
            </div>
          </div>

          {loading && !data ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-text-light" aria-hidden />
            </div>
          ) : null}

          {data && data.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-16 text-center">
              <Shield className="mx-auto h-10 w-10 text-gray-300" aria-hidden />
              <p className="mt-2 font-semibold text-text">{isAr ? "لا مستخدمين" : "No users"}</p>
              <p className="mt-1 text-sm text-text-light">
                {isAr ? "جرّب تغيير البحث أو الفلاتر." : "Try adjusting search or filters."}
              </p>
            </div>
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-3 py-3 text-start">{isAr ? "الاسم" : "Name"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "المستخدم" : "Username"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "البريد" : "Email"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "الدور" : "Role"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "الحالة" : "Status"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "أُنشئ" : "Created"}</th>
                    <th className="px-3 py-3 text-start">{isAr ? "آخر دخول" : "Last login"}</th>
                    <th className="w-12 px-2 py-3 text-center">{isAr ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="px-3 py-3 font-medium text-text">
                        {row.fullNameAr || row.fullNameEn || row.fullName}
                      </td>
                      <td className="px-3 py-3 text-text-light">{row.username}</td>
                      <td className="max-w-[200px] truncate px-3 py-3 text-text-light">{row.email}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${adminRoleBadgeClass(row.role)}`}
                        >
                          {adminRoleLabel(row.role, isAr)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${adminStatusBadgeClass(row.status)}`}
                        >
                          {adminStatusLabel(row.status, isAr)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-text-light">{fmtDate(row.createdAt, isAr)}</td>
                      <td className="px-3 py-3 text-text-light">{fmtDate(row.lastLoginAt, isAr)}</td>
                      <td ref={menuOpen === row.id ? menuRef : null} className="relative px-2 py-3 text-center">
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen((v) => (v === row.id ? null : row.id));
                            }}
                            className="rounded-lg p-2 text-text hover:bg-gray-100"
                            aria-label={isAr ? "قائمة الإجراءات" : "Actions menu"}
                            aria-expanded={menuOpen === row.id}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuOpen === row.id ? (
                            <div
                              className={`absolute z-50 mt-1 min-w-[200px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg ${
                                isAr ? "left-2" : "right-2"
                              }`}
                              role="menu"
                            >
                              <Link
                                href={`/admin/users/${row.id}`}
                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={() => setMenuOpen(null)}
                              >
                                <Eye className="h-4 w-4" aria-hidden />
                                {isAr ? "عرض / تعديل" : "View / edit"}
                              </Link>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-gray-50"
                                onClick={() => {
                                  setPwUser(row);
                                  setPwOpen(true);
                                  setMenuOpen(null);
                                }}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                                {isAr ? "تغيير كلمة المرور" : "Change password"}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-gray-50"
                                onClick={() => void toggleStatus(row)}
                              >
                                {row.status === "active"
                                  ? isAr
                                    ? "تعطيل / إيقاف"
                                    : "Suspend"
                                  : isAr
                                    ? "تفعيل"
                                    : "Activate"}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setDeleteTarget(row);
                                  setMenuOpen(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                {isAr ? "حذف" : "Delete"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {data && totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-text-light">
                {isAr ? "صفحة" : "Page"} {page} / {totalPages} ({data.total})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => pushQuery({ page: page - 1 })}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  {isAr ? "السابق" : "Prev"}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => pushQuery({ page: page + 1 })}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  {isAr ? "التالي" : "Next"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <AdminUserPasswordDialog
          open={pwOpen}
          userId={pwUser?.id ?? null}
          userLabel={pwUser ? `${pwUser.username} — ${pwUser.email}` : ""}
          isAr={isAr}
          onClose={() => {
            setPwOpen(false);
            setPwUser(null);
          }}
          onSuccess={() => void load()}
        />

        {deleteTarget ? (
          <div
            className="fixed inset-0 z-[190] flex items-center justify-center bg-black/45 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => !deleteBusy && setDeleteTarget(null)}
          >
            <div
              className="max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              dir={isAr ? "rtl" : "ltr"}
            >
              <h3 className="text-lg font-bold text-text">{isAr ? "تأكيد الحذف" : "Confirm delete"}</h3>
              <p className="mt-2 text-sm text-text-light">
                {isAr
                  ? "لا يمكن حذف مستخدم لديه إنجازات مسجلة. هل أنت متأكد من حذف هذا الحساب نهائيًا؟"
                  : "Users with achievements cannot be deleted. Permanently delete this account?"}
              </p>
              <p className="mt-2 font-mono text-xs text-text">{deleteTarget.email}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void confirmDelete()}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isAr ? "حذف" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
};

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-text-light" aria-hidden />
          </div>
        </PageContainer>
      }
    >
      <AdminUsersPageInner />
    </Suspense>
  );
}
