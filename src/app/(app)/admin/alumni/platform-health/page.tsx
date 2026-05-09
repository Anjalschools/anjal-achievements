"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function AdminAlumniPlatformHealthPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/platform-health", { credentials: "include" });
        const json = (await res.json()) as { ok?: boolean; data?: Record<string, unknown> };
        if (m && json.ok && json.data) setData(json.data);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const mongo = data?.mongo as { ok?: boolean; latencyMs?: number } | undefined;
  const automationJobs = data?.automationJobs as { pending?: number; failed?: number } | undefined;

  return (
    <div dir="rtl" className="space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">صحة المنصة — الخريجين</h1>
        <p className="mt-1 text-sm text-slate-600">قاعدة البيانات، طابور الأتمتة، وتسليم الرسائل — مع مقاييس خفيفة في الذاكرة.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">MongoDB</p>
          <p className="mt-2 text-lg font-black">{mongo?.ok ? "متصل" : "خطأ"}</p>
          <p className="text-xs text-slate-500">زمن {mongo?.latencyMs ?? "—"} ms</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">مهام معلّقة</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{automationJobs?.pending ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">مهام فاشلة</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-red-700">{automationJobs?.failed ?? "—"}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">عيّنة أخطاء الأتمتة</h2>
        <pre className="mt-3 max-h-60 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-100">
          {JSON.stringify(data?.failedJobSamples || [], null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">مقاييس العمليات</h2>
        <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-800">
          {JSON.stringify(data?.metrics || {}, null, 2)}
        </pre>
      </section>
    </div>
  );
}
