"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import type { AlumniOpportunityItem } from "@/lib/alumni/alumni-ecosystem-types";
import AlumniPageHeader from "@/components/alumni/AlumniPageHeader";
import AlumniEmptyState from "@/components/alumni/AlumniEmptyState";

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

  const dir = isAr ? "rtl" : "ltr";

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-12" dir={dir}>
      <AlumniPageHeader
        title={isAr ? "فرص الخريجين" : "Alumni opportunities"}
        description={
          isAr
            ? "فرص إرشاد وتدريب وعمل وشراكات بإشراف إداري."
            : "Mentorship, internship, jobs, and partnerships under admin moderation."
        }
        smartBack
        backLabel={isAr ? "رجوع" : "Back"}
        icon={<Briefcase className="h-6 w-6 text-white" aria-hidden />}
        breadcrumb={[
          { label: isAr ? "الخريجون" : "Alumni", href: "/alumni" },
          { label: isAr ? "الفرص" : "Opportunities" },
        ]}
        dir={dir}
      />

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <AlumniEmptyState
          icon={<Briefcase className="h-8 w-8 text-primary" aria-hidden />}
          title={isAr ? "لا توجد فرص مطابقة حالياً" : "No matching opportunities yet"}
          description={
            isAr ? "غيّر المرشحات أو عد لاحقاً بعد نشر فرص جديدة." : "Adjust filters or check back after new postings."
          }
          dir={dir}
        />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_16px_48px_-28px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 hover:border-primary/30"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{item.type}</p>
              <h2 className="mt-2 text-lg font-black text-slate-900">{item.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-4">{item.description || "—"}</p>
              <p className="mt-3 text-xs font-medium text-slate-500">
                {[item.company, item.location, item.remote ? (isAr ? "عن بُعد" : "Remote") : ""].filter(Boolean).join(" • ") || "—"}
              </p>
              {item.applicationUrl ? (
                <a
                  className="mt-4 inline-flex text-sm font-bold text-primary hover:underline"
                  href={item.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
