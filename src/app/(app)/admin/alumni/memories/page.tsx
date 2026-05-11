"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Check, Loader2, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react";

type MemoryRow = {
  id: string;
  userId: string;
  fullName: string;
  email?: string;
  imageUrl: string;
  caption: string;
  memoryYear: number | null;
  graduationYear: number | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
};

const STATUS_OPTIONS = ["all", "draft", "pending", "approved", "rejected"] as const;

const AdminAlumniMemoriesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<MemoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("pending");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<MemoryRow | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editStatus, setEditStatus] = useState<string>("pending");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("status", status);
      sp.set("page", String(page));
      sp.set("limit", String(limit));
      if (q.trim()) sp.set("q", q.trim());
      const response = await fetch(`/api/admin/alumni/memories?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await response.json()) as {
        ok?: boolean;
        items?: MemoryRow[];
        total?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error || "FAILED");
      setItems(Array.isArray(json.items) ? json.items : []);
      setTotal(typeof json.total === "number" ? json.total : 0);
    } catch {
      setError(isAr ? "تعذر تحميل الذكريات." : "Could not load memories.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [isAr, limit, page, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchStatus = async (row: MemoryRow, next: "approved" | "rejected" | "pending") => {
    setBusyId(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/alumni/memories/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error("PATCH_FAILED");
      await load();
    } catch {
      setError(isAr ? "تعذر تحديث الحالة." : "Could not update status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: MemoryRow) => {
    const ok = window.confirm(isAr ? "حذف هذه الذكرى نهائيًا؟" : "Delete this memory permanently?");
    if (!ok) return;
    setBusyId(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/alumni/memories/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("DELETE_FAILED");
      await load();
    } catch {
      setError(isAr ? "تعذر الحذف." : "Could not delete.");
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (row: MemoryRow) => {
    setEditRow(row);
    setEditCaption(row.caption || "");
    setEditYear(row.memoryYear != null ? String(row.memoryYear) : "");
    setEditStatus(row.status || "pending");
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setBusyId(editRow.id);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        status: editStatus,
        caption: editCaption,
      };
      const y = editYear.trim() ? Number(editYear.trim()) : null;
      if (y !== null && (!Number.isFinite(y) || y < 1970 || y > 2100)) {
        setError(isAr ? "سنة غير صالحة." : "Invalid year.");
        setBusyId(null);
        return;
      }
      body.memoryYear = y;
      const response = await fetch(`/api/admin/alumni/memories/${encodeURIComponent(editRow.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setEditRow(null);
      await load();
    } catch {
      setError(isAr ? "تعذر الحفظ." : "Could not save.");
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const badge = (s: string) => {
    if (s === "approved")
      return isAr ? "تم الاعتماد" : "Approved";
    if (s === "rejected") return isAr ? "مرفوضة" : "Rejected";
    if (s === "draft") return isAr ? "مسودة" : "Draft";
    return isAr ? "قيد المراجعة" : "Pending";
  };

  const dir = isAr ? "rtl" : "ltr";

  return (
    <PageContainer>
      <div dir={dir} className="space-y-6">
        <PageHeader
          title={isAr ? "مراجعة ذكريات الخريجين" : "Alumni memories review"}
          subtitle={isAr ? "اعتماد أو رفض أو تعديل الصور المرسلة من لوحة الخريج." : "Approve, reject, or edit photos submitted from the alumni dashboard."}
        />

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <label className="text-xs font-bold text-slate-500">{isAr ? "الحالة" : "Status"}</label>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="draft">{isAr ? "مسودة" : "Draft"}</option>
              <option value="pending">{isAr ? "قيد المراجعة" : "Pending"}</option>
              <option value="approved">{isAr ? "معتمدة" : "Approved"}</option>
              <option value="rejected">{isAr ? "مرفوضة" : "Rejected"}</option>
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
                placeholder={isAr ? "اسم، بريد، وصف…" : "Name, email, caption…"}
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
            {isAr ? "لا توجد ذكريات مطابقة للفلتر." : "No memories match this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">{isAr ? "صورة" : "Image"}</th>
                  <th className="px-3 py-3">{isAr ? "النص" : "Caption"}</th>
                  <th className="px-3 py-3">{isAr ? "الخريج" : "Alumni"}</th>
                  <th className="px-3 py-3">{isAr ? "سنة التخرج" : "Grad year"}</th>
                  <th className="px-3 py-3">{isAr ? "أضيفت" : "Submitted"}</th>
                  <th className="px-3 py-3">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-3 text-end">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3">
                      <div className="relative h-20 w-28 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={row.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    </td>
                    <td className="max-w-xs px-3 py-3 text-slate-800">
                      <p className="line-clamp-4 whitespace-pre-wrap">{row.caption || "—"}</p>
                      {row.memoryYear != null ? (
                        <p className="mt-1 text-xs tabular-nums text-slate-500 [direction:ltr]">
                          {isAr ? "سنة الذكرى:" : "Memory year:"} {row.memoryYear}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold text-slate-900">{row.fullName}</p>
                      {row.email ? <p className="text-xs text-slate-500">{row.email}</p> : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-700 [direction:ltr]">
                      {row.graduationYear != null ? row.graduationYear : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600 [direction:ltr]">
                      {row.submittedAt ? new Date(row.submittedAt).toLocaleString(isAr ? "ar-SA" : "en-US") : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                          row.status === "approved"
                            ? "bg-emerald-100 text-emerald-900"
                            : row.status === "rejected"
                              ? "bg-red-100 text-red-900"
                              : row.status === "draft"
                                ? "bg-slate-100 text-slate-800"
                                : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {badge(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void patchStatus(row, "approved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "اعتماد" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void patchStatus(row, "rejected")}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "رفض" : "Reject"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => openEdit(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "تعديل" : "Edit"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void handleDelete(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          {isAr ? "حذف" : "Delete"}
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
            <h2 className="text-lg font-black text-slate-900">{isAr ? "تعديل إداري" : "Admin edit"}</h2>
            <label className="mt-4 block text-xs font-bold text-slate-600">{isAr ? "الوصف" : "Caption"}</label>
            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              rows={4}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold text-slate-600">{isAr ? "سنة الذكرى" : "Memory year"}</label>
            <input
              value={editYear}
              onChange={(e) => setEditYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums [direction:ltr]"
              inputMode="numeric"
            />
            <label className="mt-3 block text-xs font-bold text-slate-600">{isAr ? "الحالة" : "Status"}</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="draft">{isAr ? "مسودة" : "Draft"}</option>
              <option value="pending">{isAr ? "قيد المراجعة" : "Pending"}</option>
              <option value="approved">{isAr ? "معتمدة" : "Approved"}</option>
              <option value="rejected">{isAr ? "مرفوضة" : "Rejected"}</option>
            </select>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={busyId === editRow.id}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {busyId === editRow.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isAr ? "حفظ" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default AdminAlumniMemoriesPage;
