"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import type { SystemHealthPayload } from "@/lib/resilience/health-collector";

export default function AdminSystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SystemHealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system/health", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; data?: SystemHealthPayload; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "LOAD_FAILED");
      }
      setData(json.data);
    } catch {
      setError("تعذر تحميل صحة النظام.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">صحة النظام</h1>
          <p className="mt-1 text-sm text-slate-600">مراقبة تشغيلية داخلية — بدون بيانات خام حساسة.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
          تحديث
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {data ? (
        <div className="space-y-4 text-sm">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-black text-slate-900">قاعدة البيانات</h2>
            <p className="mt-2 text-slate-600">
              {data.db.ok ? "متصلة" : "غير متاحة"} · latency {data.db.latencyMs}ms · readyState {data.db.readyState}
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-black text-slate-900">الذاكرة</h2>
            <p className="mt-2 text-slate-600" dir="ltr">
              heap {data.memory.heapUsedMb}/{data.memory.heapTotalMb} MB · rss {data.memory.rssMb} MB
              {data.memory.pressure ? " · PRESSURE" : ""}
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-black text-slate-900">لقطات المنافسات</h2>
            <p className="mt-2 text-slate-600">
              {data.snapshots.ok ? "سليمة" : "تحذير"} · trends {data.snapshots.trendRecordCount}
              {data.snapshots.issues.length ? ` · ${data.snapshots.issues.join(", ")}` : ""}
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-black text-slate-900">مسارات بطيئة / أخطاء</h2>
            {data.slowRoutes.length === 0 ? (
              <p className="mt-2 text-slate-500">لا سجلات حديثة في هذه العملية.</p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-600" dir="ltr">
                {data.slowRoutes.map((r) => (
                  <li key={`${r.at}-${r.path}`}>
                    {r.path} · {r.durationMs}ms · {r.errorCode ?? "slow"}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-black text-slate-900">تشغيل</h2>
            <p className="mt-2 text-slate-600">
              cron secret: {data.cron.secretConfigured ? "configured" : "missing"} · degraded:{" "}
              {data.degradedModeActive ? "yes" : "no"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{data.cache.note}</p>
          </section>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        <Link href="/admin/dashboard" className="text-primary underline">
          العودة للوحة الإدارة
        </Link>
      </p>
    </div>
  );
}
