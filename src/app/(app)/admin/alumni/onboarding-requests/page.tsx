"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, Loader2, Play, Trash2, UserCheck, UserMinus, UserX } from "lucide-react";
import {
  ALUMNI_ACTIVATION_STATUS_VALUES,
  alumniActivationStatusBadgeClass,
  alumniActivationStatusLabel,
  resolveAlumniActivationDisplayStatus,
} from "@/lib/alumni/alumni-activation-ui";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import type {
  AlumniOnboardingAdminListItem,
  AlumniOnboardingStatus,
} from "@/lib/alumni/onboarding-types";

type ListResponse = {
  ok: true;
  items: AlumniOnboardingAdminListItem[];
  total: number;
  page: number;
  limit: number;
  pendingCount: number;
  stats?: {
    breakdown: { pending: number; approved: number; rejected: number };
    activeAlumniUsers: number;
    duplicateEmailCount: number;
  };
};

const statusLabel = (status: AlumniOnboardingStatus, isAr: boolean): string => {
  if (status === "approved") return isAr ? "معتمد" : "Approved";
  if (status === "rejected") return isAr ? "مرفوض" : "Rejected";
  return isAr ? "قيد المراجعة" : "Pending";
};

const statusClass = (status: AlumniOnboardingStatus): string => {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "rejected") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
};

const AlumniOnboardingAdminPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AlumniOnboardingStatus>("pending");
  const [searchDraft, setSearchDraft] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AlumniOnboardingAdminListItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState(20);
  const [pendingCount, setPendingCount] = useState(0);
  const [serverStats, setServerStats] = useState<ListResponse["stats"] | null>(null);
  const [selected, setSelected] = useState<AlumniOnboardingAdminListItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [activationFilter, setActivationFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"createdAt" | "updatedAt" | "alumniActivationStatus">(
    "createdAt"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [softRemoving, setSoftRemoving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "info" | "error"; message: string } | null>(null);
  const [permanentPhrase, setPermanentPhrase] = useState("");
  const [permanentBusy, setPermanentBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) return setAllowed(false);
        const json = (await res.json()) as { role?: string };
        setAllowed(String(json.role || "") === "admin");
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(searchDraft.trim()), 380);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    if (allowed !== true) return;
    setListPage(1);
  }, [allowed, q]);

  type FetchOpts = { page?: number; search?: string };
  const fetchList = useCallback(
    async (opts?: FetchOpts) => {
      setLoading(true);
      setError(null);
      const page = opts?.page ?? listPage;
      const search = opts?.search ?? q;
      try {
        const sp = new URLSearchParams();
        if (statusFilter !== "all") sp.set("status", statusFilter);
        if (activationFilter !== "all") sp.set("alumniActivationStatus", activationFilter);
        if (search.trim()) sp.set("q", search.trim());
        sp.set("sort", sortField);
        sp.set("order", sortOrder);
        sp.set("page", String(page));
        sp.set("limit", String(listLimit));
        const response = await fetch(`/api/admin/alumni/onboarding-requests?${sp.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = (await response.json()) as ListResponse & { error?: string };
        if (!response.ok) throw new Error(json.error || "Failed");
        setItems(Array.isArray(json.items) ? json.items : []);
        setListTotal(Number(json.total || 0));
        setListLimit(Number(json.limit || listLimit));
        setPendingCount(Number(json.pendingCount || 0));
        setServerStats(json.stats ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setItems([]);
        setServerStats(null);
      } finally {
        setLoading(false);
      }
    },
    [listPage, q, statusFilter, activationFilter, sortField, sortOrder, listLimit]
  );

  const runPromotion = async (dryRun: boolean) => {
    setPromoBusy(true);
    setPromoMessage(null);
    try {
      const response = await fetch("/api/admin/alumni/run-student-promotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        examined?: number;
        promoted?: number;
        skipped?: number;
        dryRun?: boolean;
      };
      if (!response.ok) throw new Error(json.error || "Failed");
      setPromoMessage(
        isAr
          ? `ترقية طلاب ثالث ثانوي: مُفحوص ${json.examined ?? 0}، مُرقّى ${json.promoted ?? 0}، مُتخطّى ${json.skipped ?? 0}${json.dryRun ? " (تجريبي بدون تغيير)" : ""}.`
          : `G12 promotion: examined ${json.examined ?? 0}, promoted ${json.promoted ?? 0}, skipped ${json.skipped ?? 0}${json.dryRun ? " (dry run)" : ""}.`
      );
    } catch {
      setPromoMessage(isAr ? "تعذر تشغيل الترقية." : "Could not run promotion.");
    } finally {
      setPromoBusy(false);
    }
  };

  useEffect(() => {
    if (allowed !== true) return;
    void fetchList();
  }, [allowed, fetchList]);

  const totalPages = Math.max(1, Math.ceil(listTotal / Math.max(1, listLimit)));

  const mapRemovalApiError = (code: string | undefined): string => {
    if (!code) return isAr ? "تعذر تنفيذ العملية." : "Could not complete the action.";
    const map: Record<string, { ar: string; en: string }> = {
      NOT_FOUND: { ar: "المستخدم غير موجود.", en: "User not found." },
      NOT_ALUMNI_ACCOUNT: {
        ar: "لا يمكن إزالة هذا الحساب — ليس مرتبطًا بخريج معتمد في النظام.",
        en: "This account is not linked as an approved alumni user.",
      },
      INVALID_ID: { ar: "معرّف المستخدم غير صالح.", en: "Invalid user id." },
      CONFIRM_REQUIRED: { ar: "التأكيد مطلوب.", en: "Confirmation required." },
      CONFIRM_PHRASE_REQUIRED: {
        ar: "اكتب DELETE أو حذف نهائي بالضبط للتأكيد.",
        en: 'Type exactly DELETE or "حذف نهائي" to confirm.',
      },
      CANNOT_DELETE_SELF: { ar: "لا يمكنك حذف حسابك الحالي.", en: "You cannot delete your own account." },
      FORBIDDEN_ADMIN_TARGET: { ar: "لا يمكن حذف حساب مدير النظام.", en: "Cannot purge a system admin account." },
    };
    const row = map[code];
    if (row) return isAr ? row.ar : row.en;
    return code;
  };

  const mapPatchError = (code: string | undefined): string => {
    if (!code) return isAr ? "تعذر تنفيذ الإجراء." : "Could not complete the action.";
    if (code === "DUPLICATE_APPROVED_EMAIL") {
      return isAr
        ? "يوجد طلب معتمد آخر بنفس البريد — لا يمكن الاعتماد."
        : "Another approved request already uses this email.";
    }
    if (code === "DUPLICATE_PENDING_EMAIL_CLEAR_FIRST") {
      return isAr
        ? "يوجد طلب آخر قيد المراجعة بنفس البريد — عالج الطلب المكرر أولاً."
        : "Another pending request shares this email — resolve it first.";
    }
    return code;
  };

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/alumni/onboarding-requests", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selected.id,
          status,
          reviewNotes,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(mapPatchError(json.error));
      setSelected(null);
      setReviewNotes("");
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleCommunitySoftRemove = async () => {
    if (!selected?.userId) return;
    const ok = window.confirm(
      isAr
        ? "إزالة هذا الخريج من ظهور مجتمع الخريجين (حذف ناعم)؟ لن يُحذف الحساب بالكامل."
        : "Soft-remove this alumni from the alumni community visibility? The account is not fully deleted."
    );
    if (!ok) return;
    setSoftRemoving(true);
    setError(null);
    try {
      const payload = { confirm: true as const };
      let response = await fetch(`/api/admin/alumni/users/${selected.userId}/community-soft-remove`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 404) {
        response = await fetch("/api/admin/alumni/community-soft-remove", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, userId: selected.userId }),
        });
      }
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        alreadyRemoved?: boolean;
        error?: string;
      };
      if (!response.ok) {
        setToast({ kind: "error", message: mapRemovalApiError(json.error) });
        return;
      }
      setToast({
        kind: json.alreadyRemoved ? "info" : "success",
        message: json.alreadyRemoved
          ? isAr
            ? "تم حذف الخريج مسبقًا من مجتمع الخريجين — لا حاجة لإعادة التنفيذ."
            : "This alumni was already removed from the community."
          : isAr
            ? "تم حذف الخريج من مجتمع الخريجين بنجاح (حذف ناعم)."
            : "Alumni removed from the community successfully (soft delete).",
      });
      setSelected(null);
      setPermanentPhrase("");
      await fetchList();
    } catch {
      setToast({
        kind: "error",
        message: isAr ? "فشل الاتصال بالخادم أثناء الحذف الناعم." : "Network error during soft remove.",
      });
    } finally {
      setSoftRemoving(false);
    }
  };

  const handlePermanentRemove = async () => {
    if (!selected?.userId) return;
    const phraseOk = permanentPhrase.trim() === "DELETE" || permanentPhrase.trim() === "حذف نهائي";
    if (!phraseOk) {
      setToast({
        kind: "error",
        message: isAr ? "اكتب DELETE أو حذف نهائي في الحقل للمتابعة." : 'Type DELETE or "حذف نهائي" in the box to continue.',
      });
      return;
    }
    const ok = window.confirm(
      isAr
        ? "حذف نهائي: سيتم إزالة ملف الخريج المضمّن وسجلات CRM والموافقات المرتبطة. لن تُحذف الإنجازات أو الشهادات. هل أنت متأكد؟"
        : "Permanent purge: embedded alumni profile and CRM/consent data will be removed. Achievements and certificates stay. Continue?"
    );
    if (!ok) return;
    setPermanentBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/alumni/users/${selected.userId}/permanent-delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, confirmPhrase: permanentPhrase.trim() }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        alreadyPurged?: boolean;
        error?: string;
      };
      if (!response.ok) {
        setToast({ kind: "error", message: mapRemovalApiError(json.error) });
        return;
      }
      setToast({
        kind: json.alreadyPurged ? "info" : "success",
        message: json.alreadyPurged
          ? isAr
            ? "تم تنفيذ الحذف النهائي مسبقًا لهذا الحساب."
            : "Permanent purge was already applied for this account."
          : isAr
            ? "تم تنفيذ الحذف النهائي لبيانات الخريج بنجاح."
            : "Permanent alumni data purge completed successfully.",
      });
      setSelected(null);
      setPermanentPhrase("");
      await fetchList();
    } catch {
      setToast({
        kind: "error",
        message: isAr ? "فشل الاتصال أثناء الحذف النهائي." : "Network error during permanent delete.",
      });
    } finally {
      setPermanentBusy(false);
    }
  };

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700" dir={isAr ? "rtl" : "ltr"}>
          {isAr ? "غير مصرح لك بالوصول إلى طلبات الخريجين." : "You are not allowed to access alumni onboarding requests."}
        </p>
      </PageContainer>
    );
  }

  if (allowed === null) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-text-light" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={isAr ? "طلبات انضمام الخريجين" : "Alumni onboarding requests"}
          subtitle={isAr ? "مراجعة واعتماد طلبات الانضمام إلى مجتمع الخريجين" : "Review and approve alumni community onboarding requests"}
        />

        {toast ? (
          <div
            role="status"
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${
              toast.kind === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : toast.kind === "info"
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {toast.message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-bold text-slate-900">
            {isAr ? "ترقية تلقائية — ثالث ثانوي إلى خريج" : "Automatic promotion — Grade 12 to alumni"}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {isAr
              ? "تشغيل آمن وقابل لإعادة التنفيذ: لا ينشئ مستخدمين جدد، ويربط نفس userId. جرّب «تجريبي» أولاً."
              : "Idempotent job: no new users, same userId. Run dry run first."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={promoBusy}
              onClick={() => void runPromotion(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              {promoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              {isAr ? "تشغيل تجريبي" : "Dry run"}
            </button>
            <button
              type="button"
              disabled={promoBusy}
              onClick={() => void runPromotion(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {promoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isAr ? "تشغيل الترقية" : "Run promotion"}
            </button>
          </div>
          {promoMessage ? <p className="mt-3 text-sm text-slate-700">{promoMessage}</p> : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{isAr ? "إجمالي النتائج (حسب الفلاتر)" : "Total (current filters)"}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{listTotal}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-amber-700">{isAr ? "قيد المراجعة (نطاق البحث)" : "Pending (search scope)"}</p>
            <p className="mt-1 text-2xl font-black text-amber-800">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-emerald-700">{isAr ? "معتمد (نطاق البحث)" : "Approved (search scope)"}</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{serverStats?.breakdown.approved ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-red-700">{isAr ? "مرفوض (نطاق البحث)" : "Rejected (search scope)"}</p>
            <p className="mt-1 text-2xl font-black text-red-800">{serverStats?.breakdown.rejected ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-sky-800">{isAr ? "حسابات خريجين نشطة" : "Active alumni accounts"}</p>
            <p className="mt-1 text-2xl font-black text-sky-900">{serverStats?.activeAlumniUsers ?? "—"}</p>
            <p className="mt-1 text-[10px] text-sky-700">{isAr ? "accountType = alumni" : "accountType = alumni"}</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-orange-800">{isAr ? "تنبيهات بريد مكرر" : "Duplicate email rows"}</p>
            <p className="mt-1 text-2xl font-black text-orange-900">{serverStats?.duplicateEmailCount ?? "—"}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder={isAr ? "بحث بالاسم/البريد/الجامعة..." : "Search by name/email/university..."}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | AlumniOnboardingStatus);
                setListPage(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="all">{isAr ? "كل حالات الطلب" : "All request statuses"}</option>
              <option value="pending">{isAr ? "قيد المراجعة" : "Pending"}</option>
              <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
              <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
            </select>
            <select
              value={activationFilter}
              onChange={(e) => {
                setActivationFilter(e.target.value);
                setListPage(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="all">{isAr ? "كل حالات التفعيل" : "All activation states"}</option>
              {ALUMNI_ACTIVATION_STATUS_VALUES.map((v) => (
                <option key={v} value={v}>
                  {alumniActivationStatusLabel(v, isAr)}
                </option>
              ))}
            </select>
            <select
              value={sortField}
              onChange={(e) => {
                setSortField(e.target.value as "createdAt" | "updatedAt" | "alumniActivationStatus");
                setListPage(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="createdAt">{isAr ? "ترتيب: تاريخ الإنشاء" : "Sort: created"}</option>
              <option value="updatedAt">{isAr ? "ترتيب: آخر تحديث" : "Sort: updated"}</option>
              <option value="alumniActivationStatus">{isAr ? "ترتيب: حالة التفعيل" : "Sort: activation"}</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as "asc" | "desc");
                setListPage(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="desc">{isAr ? "تنازلي" : "Descending"}</option>
              <option value="asc">{isAr ? "تصاعدي" : "Ascending"}</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const s = searchDraft.trim();
                setQ(s);
                setListPage(1);
                void fetchList({ page: 1, search: s });
              }}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              {isAr ? "تحديث القائمة" : "Refresh list"}
            </button>
          </div>

          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center text-sm text-slate-500">
              {isAr ? "لا توجد طلبات حالياً." : "No onboarding requests found."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 text-start">{isAr ? "المتقدم" : "Applicant"}</th>
                    <th className="py-2 text-start">{isAr ? "سنة التخرج" : "Graduation"}</th>
                    <th className="py-2 text-start">{isAr ? "الجامعة/المسار" : "University / career"}</th>
                    <th className="py-2 text-start">{isAr ? "التفعيل" : "Activation"}</th>
                    <th className="py-2 text-start">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-2 text-start">{isAr ? "تنبيه" : "Alert"}</th>
                    <th className="py-2 text-start">{isAr ? "الإجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2.5">
                        <p className="font-semibold text-slate-900">{item.fullName}</p>
                        <p className="text-xs text-slate-500">{item.email}</p>
                        {item.userId ? (
                          <p className="text-[10px] text-slate-400">userId: {item.userId}</p>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-slate-700">{item.graduationYear}</td>
                      <td className="py-2.5 text-slate-700">
                        <p>{item.universityName || "—"}</p>
                        <p className="text-xs text-slate-500">
                          {[item.currentPosition, item.currentCompany].filter(Boolean).join(" — ") || "—"}
                        </p>
                      </td>
                      <td className="py-2.5">
                        {(() => {
                          const disp = resolveAlumniActivationDisplayStatus(item.alumniActivationStatus, false);
                          return (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${alumniActivationStatusBadgeClass(disp)}`}
                            >
                              {alumniActivationStatusLabel(disp, isAr)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${statusClass(item.status)}`}>
                          {statusLabel(item.status, isAr)}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {item.duplicateEmailWarning ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-800 ring-1 ring-orange-200">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {isAr ? "بريد مكرر في الطلبات" : "Duplicate request email"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(item);
                            setReviewNotes(item.reviewNotes || "");
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                        >
                          {isAr ? "عرض التفاصيل" : "Details"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && items.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <p className="tabular-nums">
                {isAr ? "صفحة" : "Page"} {listPage} / {totalPages} · {listTotal}{" "}
                {isAr ? "سجل" : "records"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={listPage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
                >
                  {isAr ? "السابق" : "Prev"}
                </button>
                <button
                  type="button"
                  disabled={listPage >= totalPages}
                  onClick={() => setListPage((p) => p + 1)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
                >
                  {isAr ? "التالي" : "Next"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-4" onClick={() => !saving && setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()} dir={isAr ? "rtl" : "ltr"}>
            <h2 className="text-xl font-black text-slate-900">{selected.fullName}</h2>
            <p className="mt-1 text-sm text-slate-500">{selected.email}</p>
            {selected.duplicateEmailWarning ? (
              <p className="mt-2 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900 ring-1 ring-orange-200">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                {isAr ? "يوجد أكثر من طلب يستخدم هذا البريد — راجع قبل الاعتماد." : "Multiple requests share this email — review before approving."}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {(() => {
                const disp = resolveAlumniActivationDisplayStatus(selected.alumniActivationStatus, false);
                return (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${alumniActivationStatusBadgeClass(disp)}`}
                  >
                    {alumniActivationStatusLabel(disp, isAr)}
                  </span>
                );
              })()}
              {selected.alumniActivationLastError ? (
                <span className="text-xs text-red-600">
                  {isAr ? "آخر خطأ: " : "Last error: "}
                  {selected.alumniActivationLastError}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <p><span className="font-bold">{isAr ? "سنة التخرج: " : "Graduation year: "}</span>{selected.graduationYear}</p>
              <p><span className="font-bold">{isAr ? "الجامعة: " : "University: "}</span>{selected.universityName || "—"}</p>
              <p><span className="font-bold">{isAr ? "التخصص: " : "Major: "}</span>{selected.major || "—"}</p>
              <p>
                <span className="font-bold">{isAr ? "الدرجة: " : "Degree: "}</span>
                {selected.degree === "أخرى" && selected.customDegree
                  ? `أخرى — ${selected.customDegree}`
                  : selected.degree || "—"}
              </p>
              <p><span className="font-bold">{isAr ? "الوظيفة: " : "Position: "}</span>{selected.currentPosition || "—"}</p>
              <p><span className="font-bold">{isAr ? "الشركة: " : "Company: "}</span>{selected.currentCompany || "—"}</p>
              <p><span className="font-bold">{isAr ? "القطاع: " : "Industry: "}</span>{selected.industry || "—"}</p>
              <p><span className="font-bold">{isAr ? "LinkedIn: " : "LinkedIn: "}</span>{selected.linkedinUrl || "—"}</p>
            </div>

            <div className="mt-4">
              <p className="text-sm font-bold text-slate-900">{isAr ? "نبذة" : "Bio"}</p>
              <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{selected.bio || "—"}</p>
            </div>

            <div className="mt-4">
              <p className="text-sm font-bold text-slate-900">{isAr ? "ملاحظات المراجعة" : "Review notes"}</p>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder={isAr ? "ملاحظات اختيارية..." : "Optional notes..."}
              />
            </div>

            {selected.userId && selected.status === "approved" ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/80 p-4">
                <p className="text-sm font-black text-red-950">{isAr ? "منطقة خطرة — حذف نهائي" : "Danger zone — permanent purge"}</p>
                <p className="mt-1 text-xs text-red-900">
                  {isAr
                    ? "يحذف ملف الخريج المضمّن وسجلات CRM والموافقات؛ لا يحذف الإنجازات. اكتب DELETE أو حذف نهائي ثم نفّذ."
                    : "Removes embedded alumni profile, CRM row, consent, and cancels open mentorships. Achievements are kept. Type DELETE or حذف نهائي."}
                </p>
                <input
                  value={permanentPhrase}
                  onChange={(e) => setPermanentPhrase(e.target.value)}
                  placeholder={isAr ? "DELETE أو حذف نهائي" : "DELETE or حذف نهائي"}
                  autoComplete="off"
                  className="mt-3 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={permanentBusy}
                  onClick={() => void handlePermanentRemove()}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-800 px-4 py-2 text-sm font-bold text-white hover:bg-red-900 disabled:opacity-60"
                >
                  {permanentBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                  {isAr ? "تنفيذ الحذف النهائي" : "Run permanent purge"}
                </button>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">
                {isAr ? "إغلاق" : "Close"}
              </button>
              {selected.userId && selected.status === "approved" ? (
                <button
                  type="button"
                  disabled={softRemoving}
                  onClick={() => void handleCommunitySoftRemove()}
                  className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100 disabled:opacity-60"
                >
                  {softRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                  {isAr ? "حذف من مجتمع الخريجين (ناعم)" : "Remove from alumni community (soft)"}
                </button>
              ) : null}
              <button type="button" disabled={saving} onClick={() => void handleDecision("rejected")} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                {isAr ? "رفض الطلب" : "Reject"}
              </button>
              <button type="button" disabled={saving} onClick={() => void handleDecision("approved")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                {isAr ? "اعتماد الطلب" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default AlumniOnboardingAdminPage;
