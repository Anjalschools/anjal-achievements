"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/alumni/stories?q=${encodeURIComponent(q)}`, { cache: "no-store" });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt, content, published: true }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "Failed");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !current }),
    });
    await load();
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
          <div className="mb-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isAr ? "بحث..." : "Search..."} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button onClick={() => void load()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">{isAr ? "بحث" : "Search"}</button>
          </div>
          {loading ? <p className="py-6 text-center text-slate-500">{isAr ? "جاري التحميل..." : "Loading..."}</p> : null}
          {!loading ? (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">/{item.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void toggle(item.id, "featured", item.featured)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">
                      {item.featured ? (isAr ? "إلغاء التمييز" : "Unfeature") : (isAr ? "تمييز" : "Feature")}
                    </button>
                    <button onClick={() => void toggle(item.id, "published", item.published)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">
                      {item.published ? (isAr ? "إلغاء النشر" : "Unpublish") : (isAr ? "نشر" : "Publish")}
                    </button>
                    <a href={`/alumni/stories/${item.slug}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                      {isAr ? "معاينة" : "Preview"}
                    </a>
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
