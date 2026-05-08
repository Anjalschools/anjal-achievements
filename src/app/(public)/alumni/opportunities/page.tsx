"use client";

import { useEffect, useMemo, useState } from "react";
import { getLocale } from "@/lib/i18n";
import type { AlumniOpportunityItem } from "@/lib/alumni/alumni-ecosystem-types";

const AlumniOpportunitiesPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [type, setType] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [company, setCompany] = useState("");
  const [items, setItems] = useState<AlumniOpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (type) sp.set("type", type);
    if (remoteOnly) sp.set("remote", "1");
    if (company.trim()) sp.set("company", company.trim());
    return sp.toString();
  }, [type, remoteOnly, company]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/public/alumni-opportunities?${query}`, { cache: "no-store" });
        const json = await response.json();
        setItems(Array.isArray(json.items) ? json.items : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14" dir={isAr ? "rtl" : "ltr"}>
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-primary p-6 text-white sm:p-8">
        <h1 className="text-3xl font-black">{isAr ? "فرص الخريجين" : "Alumni opportunities"}</h1>
        <p className="mt-2 text-sm text-sky-100">
          {isAr ? "فرص إرشاد وتدريب وعمل وشراكات بإشراف إداري." : "Mentorship, internship, jobs, and partnerships under admin moderation."}
        </p>
      </header>

      <section className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="">{isAr ? "كل الأنواع" : "All types"}</option>
          <option value="mentorship">{isAr ? "إرشاد" : "Mentorship"}</option>
          <option value="internship">{isAr ? "تدريب" : "Internship"}</option>
          <option value="job">{isAr ? "وظائف" : "Job"}</option>
          <option value="workshop">{isAr ? "ورش" : "Workshop"}</option>
          <option value="speaking">{isAr ? "تحدث" : "Speaking"}</option>
          <option value="partnership">{isAr ? "شراكة" : "Partnership"}</option>
        </select>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder={isAr ? "شركة" : "Company"}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
          {isAr ? "عن بُعد فقط" : "Remote only"}
        </label>
      </section>

      {loading ? (
        <p className="py-10 text-center text-slate-500">{isAr ? "جاري التحميل..." : "Loading..."}</p>
      ) : (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{item.type}</p>
              <h2 className="mt-2 text-lg font-black text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600 line-clamp-4">{item.description || "—"}</p>
              <p className="mt-3 text-xs text-slate-500">
                {[item.company, item.location, item.remote ? (isAr ? "عن بُعد" : "Remote") : ""].filter(Boolean).join(" • ") || "—"}
              </p>
              {item.applicationUrl ? (
                <a className="mt-4 inline-flex text-sm font-bold text-primary hover:underline" href={item.applicationUrl} target="_blank">
                  {isAr ? "رابط التقديم" : "Apply link"}
                </a>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default AlumniOpportunitiesPage;
