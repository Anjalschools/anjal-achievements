"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type FailedJobSample = { type?: string; error?: string; retries?: number; at?: string | null };
type DeliveryRow = { channel: string; failures: number; successes: number };
type MetricsSummary = {
  latencySamples?: number;
  p50MsApprox?: number;
  jobsLastHour?: { ok: number; failed: number };
};
type QueueSnap = { metrics?: Record<string, number>; provider?: string };

type HealthPayload = {
  mongo?: { ok?: boolean; latencyMs?: number };
  automationJobs?: { pending?: number; failed?: number };
  campaignRecipientsFailed?: number;
  failedJobSamples?: FailedJobSample[];
  delivery?: DeliveryRow[];
  metrics?: MetricsSummary;
  queue?: QueueSnap;
};

export default function AdminAlumniPlatformHealthPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alumni/platform-health", { credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; data?: HealthPayload; error?: string };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || "LOAD_FAILED");
      }
      setData(json.data);
    } catch {
      setError("تعذر تحميل لوحة المراقبة.");
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

  const mongo = data?.mongo;
  const automationJobs = data?.automationJobs;
  const campaignRecipientsFailed = data?.campaignRecipientsFailed ?? 0;
  const failedJobSamples = Array.isArray(data?.failedJobSamples) ? data!.failedJobSamples! : [];
  const delivery = Array.isArray(data?.delivery) ? data!.delivery! : [];
  const metrics = data?.metrics;
  const queue = data?.queue;
  const qm = queue?.metrics || {};

  return (
    <div dir="rtl" className="space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">صحة المنصة — الخريجين</h1>
          <p className="mt-1 text-sm text-slate-600">
            قاعدة البيانات، طابور الأتمتة، التسليم، ومؤشرات خفيفة في الذاكرة — بدون عرض بيانات خام.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          تحديث
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">MongoDB</p>
          <p className="mt-2 flex items-center gap-2 text-lg font-black">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${mongo?.ok ? "bg-emerald-500" : "bg-red-500"}`}
              aria-hidden
            />
            {mongo?.ok ? "متصل" : "غير متاح"}
          </p>
          <p className="mt-1 text-xs text-slate-500">زمن الاستجابة التقريبي: {mongo?.latencyMs ?? "—"} ms</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">مهام الأتمتة المعلّقة</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{automationJobs?.pending ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">مهام أتمتة فاشلة</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-red-700">{automationJobs?.failed ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">تسليم الحملات — فاشل</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-amber-700">{campaignRecipientsFailed}</p>
          <p className="mt-1 text-[11px] text-slate-500">مستلمو حملات بريد بحالة فشل</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">عيّنة أخطاء الأتمتة</h2>
          {failedJobSamples.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">لا توجد عيّنات فشل حديثة مسجّلة هنا.</p>
          ) : (
            <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto text-sm">
              {failedJobSamples.map((j, idx) => (
                <li key={`${j.type}-${j.at}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="font-bold text-slate-900">{j.type || "نوع غير معروف"}</p>
                  <p className="mt-1 text-xs text-slate-600">{j.error || "—"}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    إعادة المحاولة: {j.retries ?? "—"} · {j.at ? new Date(j.at).toLocaleString("ar-SA") : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">صحة التسليم (قنوات)</h2>
          {delivery.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">لا توجد بيانات تسليم متراكمة بعد.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {delivery.map((d) => (
                <li key={d.channel} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-bold text-slate-800">{d.channel}</span>
                  <span className="tabular-nums text-slate-600">
                    نجاح {d.successes} · فشل {d.failures}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">مقاييس الطلبات (ساعة أخيرة)</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>عيّنات زمن الاستجابة</span>
              <span className="font-black tabular-nums">{metrics?.latencySamples ?? 0}</span>
            </li>
            <li className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>وسيط زمن الاستجابة التقريبي</span>
              <span className="font-black tabular-nums">{metrics?.p50MsApprox ?? 0} ms</span>
            </li>
            <li className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>مهام معالَجة (نجاح / فشل)</span>
              <span className="font-black tabular-nums">
                {metrics?.jobsLastHour?.ok ?? 0} / {metrics?.jobsLastHour?.failed ?? 0}
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">طابور محلي</h2>
          <p className="mt-1 text-xs text-slate-500">
            المزوّد: <span className="font-bold text-slate-700">{queue?.provider || "local"}</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.keys(qm).length === 0 ? (
              <li className="text-slate-500">لا توجد عدادات طابور بعد.</li>
            ) : (
              Object.entries(qm).map(([k, v]) => (
                <li key={k} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-bold text-slate-800">{k}</span>
                  <span className="tabular-nums text-slate-600">{v}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
