"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Archive, Loader2, RefreshCw } from "lucide-react";

type OpportunityItem = {
  id: string;
  title: string;
  type: string;
  company: string | null;
  remote: boolean;
  published: boolean;
  featured: boolean;
  createdAt: string | null;
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

const AdminAlumniOpportunitiesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("mentorship");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/alumni/opportunities", { cache: "no-store", credentials: "include" });
      const json = (await response.json()) as { items?: OpportunityItem[]; ok?: boolean };
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setError(isAr ? "تعذر تحميل الفرص." : "Could not load opportunities.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/alumni/opportunities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type, description, company, published: true }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed");
      setTitle("");
      setDescription("");
      setCompany("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  const toggle = async (id: string, field: "published" | "featured", current: boolean) => {
    await fetch("/api/admin/alumni/opportunities", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: !current }),
    });
    await load();
  };

  const handleArchive = async (id: string) => {
    const ok = window.confirm(
      isAr ? "أرشفة هذه الفرصة؟ ستُخفى من القوائم العامة." : "Archive this opportunity? It will be hidden from public lists."
    );
    if (!ok) return;
    setArchivingId(id);
    try {
      const response = await fetch("/api/admin/alumni/opportunities", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archive: true }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"} className="space-y-6">
        <PageHeader
          title={isAr ? "فرص الخريجين" : "Alumni opportunities"}
          subtitle={isAr ? "إدارة ونشر فرص الإرشاد والتدريب والعمل" : "Manage and publish mentorship, internship, and job opportunities"}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">{isAr ? "إضافة فرصة" : "Create opportunity"}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAr ? "العنوان" : "Title"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="mentorship">{isAr ? "إرشاد" : "Mentorship"}</option>
              <option value="internship">{isAr ? "تدريب" : "Internship"}</option>
              <option value="job">{isAr ? "وظيفة" : "Job"}</option>
              <option value="workshop">{isAr ? "ورشة" : "Workshop"}</option>
              <option value="speaking">{isAr ? "تحدث" : "Speaking"}</option>
              <option value="partnership">{isAr ? "شراكة" : "Partnership"}</option>
            </select>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={isAr ? "الشركة" : "Company"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isAr ? "الوصف" : "Description"}
              rows={3}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <button
            onClick={() => void handleCreate()}
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {isAr ? "إنشاء ونشر" : "Create & publish"}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-700">
              {isAr ? "الفرص المنشورة" : "Published opportunities"}{" "}
              <span className="tabular-nums text-slate-500">({items.length})</span>
            </p>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              {isAr ? "تحديث" : "Refresh"}
            </button>
          </div>

          {loading && items.length === 0 ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" aria-hidden />
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center text-sm text-slate-600">
              {isAr ? "لا توجد فرص بعد — أنشئ فرصة من النموذج أعلاه." : "No opportunities yet — create one using the form above."}
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 text-start">{isAr ? "العنوان" : "Title"}</th>
                    <th className="py-2 text-start">{isAr ? "النوع" : "Type"}</th>
                    <th className="py-2 text-start">{isAr ? "الشركة" : "Company"}</th>
                    <th className="py-2 text-start">{isAr ? "الحالة" : "Status"}</th>
                    <th className="py-2 text-start">{isAr ? "تاريخ الإنشاء" : "Created"}</th>
                    <th className="py-2 text-start">{isAr ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2.5">
                        <p className="font-bold text-slate-900">{item.title}</p>
                        {item.featured ? (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            {isAr ? "مميز" : "Featured"}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-slate-700">{typeLabel(item.type, isAr)}</td>
                      <td className="py-2.5 text-slate-700">{item.company || "—"}</td>
                      <td className="py-2.5">
                        <span className="text-xs text-slate-600">
                          {item.published ? (isAr ? "منشور" : "Live") : (isAr ? "مسودة" : "Draft")}
                          {item.remote ? ` · ${isAr ? "عن بُعد" : "Remote"}` : ""}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString(isAr ? "ar-SA" : undefined) : "—"}
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => void toggle(item.id, "featured", item.featured)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50"
                          >
                            {item.featured ? (isAr ? "إلغاء التمييز" : "Unfeature") : isAr ? "تمييز" : "Feature"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggle(item.id, "published", item.published)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50"
                          >
                            {item.published ? (isAr ? "إخفاء" : "Unpublish") : isAr ? "نشر" : "Publish"}
                          </button>
                          <button
                            type="button"
                            disabled={archivingId === item.id}
                            onClick={() => void handleArchive(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {archivingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            ) : (
                              <Archive className="h-3 w-3" aria-hidden />
                            )}
                            {isAr ? "أرشفة" : "Archive"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </PageContainer>
  );
};

export default AdminAlumniOpportunitiesPage;
