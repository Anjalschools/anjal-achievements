"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserCheck, UserX } from "lucide-react";
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
  const [q, setQ] = useState("");
  const [items, setItems] = useState<AlumniOnboardingAdminListItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selected, setSelected] = useState<AlumniOnboardingAdminListItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (statusFilter !== "all") sp.set("status", statusFilter);
      if (q.trim()) sp.set("q", q.trim());
      sp.set("page", "1");
      sp.set("limit", "30");
      const response = await fetch(`/api/admin/alumni/onboarding-requests?${sp.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as ListResponse & { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
      setPendingCount(Number(json.pendingCount || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    if (allowed !== true) return;
    void load();
  }, [allowed, load]);

  const stats = useMemo(
    () => ({
      total: items.length,
      approved: items.filter((i) => i.status === "approved").length,
      rejected: items.filter((i) => i.status === "rejected").length,
    }),
    [items]
  );

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/alumni/onboarding-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selected.id,
          status,
          reviewNotes,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed");
      setSelected(null);
      setReviewNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">{isAr ? "إجمالي النتائج" : "Total results"}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-amber-700">{isAr ? "قيد المراجعة" : "Pending"}</p>
            <p className="mt-1 text-2xl font-black text-amber-800">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-emerald-700">{isAr ? "معتمد" : "Approved"}</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{stats.approved}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-red-700">{isAr ? "مرفوض" : "Rejected"}</p>
            <p className="mt-1 text-2xl font-black text-red-800">{stats.rejected}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isAr ? "بحث بالاسم/البريد/الجامعة..." : "Search by name/email/university..."}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | AlumniOnboardingStatus)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="all">{isAr ? "كل الحالات" : "All statuses"}</option>
              <option value="pending">{isAr ? "قيد المراجعة" : "Pending"}</option>
              <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
              <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
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
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 text-start">{isAr ? "المتقدم" : "Applicant"}</th>
                    <th className="py-2 text-start">{isAr ? "سنة التخرج" : "Graduation"}</th>
                    <th className="py-2 text-start">{isAr ? "الجامعة/المسار" : "University / career"}</th>
                    <th className="py-2 text-start">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-2 text-start">{isAr ? "الإجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2.5">
                        <p className="font-semibold text-slate-900">{item.fullName}</p>
                        <p className="text-xs text-slate-500">{item.email}</p>
                      </td>
                      <td className="py-2.5 text-slate-700">{item.graduationYear}</td>
                      <td className="py-2.5 text-slate-700">
                        <p>{item.universityName || "—"}</p>
                        <p className="text-xs text-slate-500">
                          {[item.currentPosition, item.currentCompany].filter(Boolean).join(" — ") || "—"}
                        </p>
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${statusClass(item.status)}`}>
                          {statusLabel(item.status, isAr)}
                        </span>
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
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-4" onClick={() => !saving && setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()} dir={isAr ? "rtl" : "ltr"}>
            <h2 className="text-xl font-black text-slate-900">{selected.fullName}</h2>
            <p className="mt-1 text-sm text-slate-500">{selected.email}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <p><span className="font-bold">{isAr ? "سنة التخرج: " : "Graduation year: "}</span>{selected.graduationYear}</p>
              <p><span className="font-bold">{isAr ? "الجامعة: " : "University: "}</span>{selected.universityName || "—"}</p>
              <p><span className="font-bold">{isAr ? "التخصص: " : "Major: "}</span>{selected.major || "—"}</p>
              <p><span className="font-bold">{isAr ? "الدرجة: " : "Degree: "}</span>{selected.degree || "—"}</p>
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

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">
                {isAr ? "إغلاق" : "Close"}
              </button>
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
