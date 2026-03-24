"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

const AdminAuditLogPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [actionType, setActionType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", "25");
      if (actionType.trim()) p.set("actionType", actionType.trim());
      const res = await fetch(`/api/admin/audit-logs?${p}`, { cache: "no-store" });
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, actionType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer>
      <h1 className="text-2xl font-black text-text">{isAr ? "سجل العمليات" : "Audit log"}</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder={isAr ? "نوع العملية" : "Action type"}
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
        />
        <button type="button" onClick={() => setPage(1)} className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold">
          {isAr ? "تصفية" : "Filter"}
        </button>
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8 text-center text-text-light">{isAr ? "لا توجد سجلات" : "No entries"}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-start font-bold">
              <tr>
                <th className="p-2">{isAr ? "التاريخ" : "Date"}</th>
                <th className="p-2">{isAr ? "المنفذ" : "Actor"}</th>
                <th className="p-2">{isAr ? "العملية" : "Action"}</th>
                <th className="p-2">{isAr ? "الكيان" : "Entity"}</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={String(row._id)} className="border-t">
                  <td className="p-2 whitespace-nowrap">
                    {row.createdAt ? new Date(String(row.createdAt)).toLocaleString(isAr ? "ar-SA" : "en-GB") : "—"}
                  </td>
                  <td className="p-2">{String(row.actorEmail || row.actorName || "—")}</td>
                  <td className="p-2">{String(row.actionType || "")}</td>
                  <td className="p-2">{String(row.entityType || "")} {String(row.entityId || "")}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setDetail(row)}
                    >
                      {isAr ? "تفاصيل" : "Details"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border px-3 py-1 disabled:opacity-40"
        >
          {isAr ? "السابق" : "Prev"}
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          type="button"
          disabled={page * 25 >= total}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border px-3 py-1 disabled:opacity-40"
        >
          {isAr ? "التالي" : "Next"}
        </button>
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-bold">{isAr ? "تفاصيل السجل" : "Log detail"}</h2>
            <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-text">
              {JSON.stringify(
                {
                  descriptionAr: detail.descriptionAr,
                  metadata: detail.metadata,
                  before: detail.before,
                  after: detail.after,
                },
                null,
                2
              )}
            </pre>
            <button type="button" className="mt-4 rounded-lg bg-gray-100 px-4 py-2" onClick={() => setDetail(null)}>
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
};

export default AdminAuditLogPage;
