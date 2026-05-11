"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { BookOpen, Loader2, RefreshCw, Trash2 } from "lucide-react";

type StoryItem = {
  id: string;
  title: string;
  slug: string;
  featured: boolean;
  published: boolean;
};

const AdminAlumniStoriesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [items, setItems] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/alumni/stories?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await response.json();
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/alumni/stories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt, content, published: true }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: {
          fieldErrors?: Record<string, { ar: string; en: string } | string[]>;
        };
      };
      if (!response.ok) {
        const fe = json.issues?.fieldErrors;
        const parts: string[] = [];
        if (fe) {
          for (const v of Object.values(fe)) {
            if (v && typeof v === "object" && !Array.isArray(v) && "ar" in v && "en" in v) {
              parts.push(isAr ? v.ar : v.en);
            } else if (Array.isArray(v)) {
              parts.push(v.join(", "));
            }
          }
        }
        const detail = parts.filter(Boolean).join(" · ");
        throw new Error(detail || json.error || "Failed");
      }
      setTitle("");
      setExcerpt("");
      setContent("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  const toggle = async (id: string, field: "published" | "featured", current: boolean) => {
    await fetch(`/api/admin/alumni/stories/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !current }),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm(isAr ? "حذف هذه القصة نهائيًا؟" : "Delete this story permanently?");
    if (!ok) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/alumni/stories/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("DELETE_FAILED");
      await load();
    } catch {
      setError(isAr ? "تعذر الحذف." : "Could not delete.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"} className="space-y-6">
        <PageHeader
          title={isAr ? "قصص الخريجين" : "Alumni stories"}
          subtitle={isAr ? "إدارة القصص المميزة والنشر العام" : "Manage featured stories and public publishing"}
        />
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">{isAr ? "إضافة قصة" : "Create story"}</h2>
          <div className="mt-3 grid gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isAr ? "العنوان" : "Title"} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder={isAr ? "ملخص" : "Excerpt"} rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={isAr ? "المحتوى" : "Content"} rows={6} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <button onClick={() => void handleCreate()} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
            {isAr ? "إنشاء ونشر" : "Create & publish"}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isAr ? "بحث..." : "Search..."}
              className="min-w-[160px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              {isAr ? "تحديث" : "Refresh"}
            </button>
          </div>
          <p className="mb-3 text-xs font-bold text-slate-500">
            {isAr ? "النتائج: " : "Results: "}
            {items.length}
          </p>
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" aria-hidden />
            </div>
          ) : null}
          {!loading && items.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
              <BookOpen className="h-10 w-10 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-bold text-slate-700">{isAr ? "لا توجد قصص" : "No stories yet"}</p>
              <p className="mt-1 max-w-sm px-4 text-xs text-slate-500">
                {isAr ? "أضف قصة من النموذج أعلاه لتظهر في القائمة." : "Create a story using the form above."}
              </p>
            </div>
          ) : null}
          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">/{item.slug}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.featured ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          {isAr ? "مميز" : "Featured"}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.published ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.published ? (isAr ? "منشور" : "Published") : isAr ? "مسودة" : "Draft"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void toggle(item.id, "featured", item.featured)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                    >
                      {item.featured ? (isAr ? "إلغاء التمييز" : "Unfeature") : isAr ? "تمييز" : "Feature"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggle(item.id, "published", item.published)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                    >
                      {item.published ? (isAr ? "إلغاء النشر" : "Unpublish") : isAr ? "نشر" : "Publish"}
                    </button>
                    <a
                      href={`/alumni/stories/${item.slug}`}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      {isAr ? "معاينة" : "Preview"}
                    </a>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                      {isAr ? "حذف" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </PageContainer>
  );
};

export default AdminAlumniStoriesPage;
