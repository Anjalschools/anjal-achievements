"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Check, Loader2, Pencil, RefreshCw, Search, X } from "lucide-react";

type ReviewStatus = "pending_review" | "approved" | "rejected" | "archived" | "";

type OppRow = {
  id: string;
  title: string;
  type: string;
  company: string | null;
  description?: string;
  remote: boolean;
  published: boolean;
  reviewStatus: string;
  featured: boolean;
  createdAt: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  applicationUrl: string | null;
};

const typeLabel = (t: string, isAr: boolean): string => {
  const map: Record<string, { ar: string; en: string }> = {
    mentorship: { ar: "إرشاد", en: "Mentorship" },
    internship: { ar: "تدريب", en: "Internship" },
    job: { ar: "وظيفة", en: "Job" },
    workshop: { ar: "ورشة", en: "Workshop" },
    speaking: { ar: "تحدث", en: "Speaking" },
    partnership: { ar: "شراكة", en: "Partnership" },
  };
  const row = map[t];
  if (!row) return t;
  return isAr ? row.ar : row.en;
};

const AdminAlumniOpportunitiesReviewPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<OppRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(40);
  const [status, setStatus] = useState<ReviewStatus>("pending_review");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<OppRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editType, setEditType] = useState("job");
  const [editDesc, setEditDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      sp.set("page", String(page));
      sp.set("limit", String(limit));
      if (q.trim()) sp.set("q", q.trim());
      const response = await fetch(`/api/admin/alumni/opportunities?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await response.json()) as {
        ok?: boolean;
        items?: OppRow[];
        total?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error || "FAILED");
      setItems(Array.isArray(json.items) ? json.items : []);
      setTotal(typeof json.total === "number" ? json.total : 0);
    } catch {
      setError(isAr ? "تعذر تحميل الفرص." : "Could not load opportunities.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [isAr, limit, page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchReview = async (row: OppRow, reviewStatus: "approved" | "rejected") => {
    setBusyId(row.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/alumni/opportunities", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, reviewStatus }),
      });
      const j = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(j.error || "PATCH_FAILED");
      await load();
    } catch {
      setError(isAr ? "تعذر تحديث حالة المراجعة." : "Could not update review status.");
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (row: OppRow) => {
    setEditRow(row);
    setEditTitle(row.title || "");
    setEditCompany(row.company || "");
    setEditType(row.type || "job");
    setEditDesc(row.description || "");
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setBusyId(editRow.id);
    setError(null);
    try {
      const payload = {
        id: editRow.id,
        title: editTitle,
        company: editCompany,
        type: editType,
        description: editDesc,
      };

      const response = await fetch("/api/admin/alumni/opportunities", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(j.error || "SAVE_FAILED");
      setEditRow(null);
      await load();
    } catch {
      setError(isAr ? "تعذر حفظ التعديل." : "Could not save changes.");
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const statusBadge = (rs: string) => {
    if (rs === "approved") return isAr ? "معتمدة" : "Approved";
    if (rs === "rejected") return isAr ? "مرفوضة" : "Rejected";
    if (rs === "archived") return isAr ? "مؤرشفة" : "Archived";
    return isAr ? "قيد المراجعة" : "Pending review";
  };

  const dir = isAr ? "rtl" : "ltr";

  return (
    <PageContainer>
      <div dir={dir} className="space-y-6">
        <PageHeader
          title={isAr ? "مراجعة فرص الخريجين" : "Alumni opportunities review"}
          subtitle={isAr ? "اعتماد أو رفض الطلبات قبل ظهورها للمجتمع." : "Approve or reject submissions before they appear publicly."}
        />

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">{isAr ? "حالة المراجعة" : "Review status"}</label>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as ReviewStatus);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="pending_review">{isAr ? "قيد المراجعة" : "Pending review"}</option>
              <option value="approved">{isAr ? "معتمدة" : "Approved"}</option>
              <option value="rejected">{isAr ? "مرفوضة" : "Rejected"}</option>
              <option value="archived">{isAr ? "مؤرشفة" : "Archived"}</option>
              <option value="">{isAr ? "الكل (غير المؤرشفة)" : "All (non-archived)"}</option>
            </select>
          </div>
          <div className="flex min-w-[200px] flex-[2] flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">{isAr ? "بحث" : "Search"}</label>
            <div className="flex gap-2">
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    setQ(qDraft);
                  }
                }}
                placeholder={isAr ? "عنوان، شركة، نوع…" : "Title, company, type…"}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setQ(qDraft);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"
              >
                <Search className="h-4 w-4" aria-hidden />
                {isAr ? "بحث" : "Search"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {isAr ? "تحديث" : "Refresh"}
          </button>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm font-semibold text-slate-600">
            {isAr ? "لا توجد فرص مطابقة للفلتر." : "No opportunities match this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">{isAr ? "العنوان" : "Title"}</th>
                  <th className="px-3 py-3">{isAr ? "النوع" : "Type"}</th>
                  <th className="px-3 py-3">{isAr ? "الشركة" : "Company"}</th>
                  <th className="px-3 py-3">{isAr ? "المُرسل" : "Submitted by"}</th>
                  <th className="px-3 py-3">{isAr ? "التاريخ" : "Submitted"}</th>
                  <th className="px-3 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-3 text-end">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="max-w-xs px-3 py-3 font-bold text-slate-900">{row.title}</td>
                    <td className="px-3 py-3 text-slate-700">{typeLabel(row.type, isAr)}</td>
                    <td className="px-3 py-3 text-slate-700">{row.company || "—"}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <span className="font-semibold">{row.createdByName || "—"}</span>
                      {row.createdByUserId ? (
                        <span className="mt-0.5 block text-[10px] tabular-nums text-slate-400 [direction:ltr]">{row.createdByUserId}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 [direction:ltr]">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US") : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                          row.reviewStatus === "approved"
                            ? "bg-emerald-100 text-emerald-900"
                            : row.reviewStatus === "rejected"
                              ? "bg-red-100 text-red-900"
                              : row.reviewStatus === "archived"
                                ? "bg-slate-200 text-slate-800"
                                : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {statusBadge(row.reviewStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === row.id || row.reviewStatus === "approved"}
                          onClick={() => void patchReview(row, "approved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-black text-white disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "اعتماد" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void patchReview(row, "rejected")}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-black text-white disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "رفض" : "Reject"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => openEdit(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "تعديل" : "Edit"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-700">
            <span className="tabular-nums [direction:ltr]">
              {isAr ? "الصفحة" : "Page"} {page} / {totalPages} · {total} {isAr ? "إجمالي" : "total"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
              >
                {isAr ? "السابق" : "Prev"}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-40"
              >
                {isAr ? "التالي" : "Next"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {editRow ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal dir={dir}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900">{isAr ? "تعديل الفرصة" : "Edit opportunity"}</h2>
            <label className="mt-4 block text-xs font-bold text-slate-600">{isAr ? "العنوان" : "Title"}</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold text-slate-600">{isAr ? "الشركة" : "Company"}</label>
            <input
              value={editCompany}
              onChange={(e) => setEditCompany(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold text-slate-600">{isAr ? "النوع" : "Type"}</label>
            <select value={editType} onChange={(e) => setEditType(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="mentorship">{isAr ? "إرشاد" : "Mentorship"}</option>
              <option value="internship">{isAr ? "تدريب" : "Internship"}</option>
              <option value="job">{isAr ? "وظيفة" : "Job"}</option>
              <option value="workshop">{isAr ? "ورشة" : "Workshop"}</option>
              <option value="speaking">{isAr ? "تحدث" : "Speaking"}</option>
              <option value="partnership">{isAr ? "شراكة" : "Partnership"}</option>
            </select>
            <label className="mt-3 block text-xs font-bold text-slate-600">{isAr ? "الوصف" : "Description"}</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={busyId === editRow.id}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {busyId === editRow.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isAr ? "حفظ" : "Save"}
              </button>
              <button type="button" onClick={() => setEditRow(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default AdminAlumniOpportunitiesReviewPage;
