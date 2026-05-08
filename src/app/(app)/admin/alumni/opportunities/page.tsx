"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";

type OpportunityItem = {
  id: string;
  title: string;
  type: string;
  company: string | null;
  remote: boolean;
  published: boolean;
  featured: boolean;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/alumni/opportunities", { cache: "no-store" });
      const json = await response.json();
      setItems(Array.isArray(json.items) ? json.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    await fetch("/api/admin/alumni/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, type, description, company, published: true }),
    });
    setTitle("");
    setDescription("");
    setCompany("");
    await load();
  };

  const toggle = async (id: string, field: "published" | "featured", current: boolean) => {
    await fetch("/api/admin/alumni/opportunities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: !current }),
    });
    await load();
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isAr ? "العنوان" : "Title"} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="mentorship">{isAr ? "إرشاد" : "Mentorship"}</option>
              <option value="internship">{isAr ? "تدريب" : "Internship"}</option>
              <option value="job">{isAr ? "وظيفة" : "Job"}</option>
              <option value="workshop">{isAr ? "ورشة" : "Workshop"}</option>
              <option value="speaking">{isAr ? "تحدث" : "Speaking"}</option>
              <option value="partnership">{isAr ? "شراكة" : "Partnership"}</option>
            </select>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={isAr ? "الشركة" : "Company"} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isAr ? "الوصف" : "Description"} rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
          </div>
          <button onClick={() => void handleCreate()} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
            {isAr ? "إنشاء ونشر" : "Create & publish"}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {loading ? (
            <p className="py-6 text-center text-slate-500">{isAr ? "جاري التحميل..." : "Loading..."}</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="font-bold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{[item.type, item.company, item.remote ? "Remote" : ""].filter(Boolean).join(" • ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void toggle(item.id, "featured", item.featured)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">
                      {item.featured ? (isAr ? "إلغاء التمييز" : "Unfeature") : (isAr ? "تمييز" : "Feature")}
                    </button>
                    <button onClick={() => void toggle(item.id, "published", item.published)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">
                      {item.published ? (isAr ? "إلغاء النشر" : "Unpublish") : (isAr ? "نشر" : "Publish")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
};

export default AdminAlumniOpportunitiesPage;
