"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const segmentLabelAr = (key: string): string => {
  const k = String(key || "").trim();
  const map: Record<string, string> = {
    champion: "مميزون — علاقة قوية",
    engaged: "منخرطون",
    active: "نشطون",
    warming: "متزايدو النشاط",
    cooling: "تراجع النشاط",
    at_risk: "معرضون للخمود",
    dormant: "خاملون",
    new: "جدد",
    unknown: "غير مصنّف",
  };
  return map[k] || k.replace(/_/g, " ");
};

export default function AdminAlumniCrmPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<{
    alumniTotal: number;
    avgScore: number;
    jobsPending: number;
    segments: Record<string, number>;
  } | null>(null);
  const [segments, setSegments] = useState<{ segment: string; count: number; avgScore: number }[]>([]);
  const [top, setTop] = useState<{ id: string; fullName: string; reputationScore: number }[]>([]);
  const [inactive, setInactive] = useState<{ id: string; fullName: string; lastLoginAt: string | null }[]>([]);
  const [log, setLog] = useState<string | null>(null);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const [o, s, t, i] = await Promise.all([
          fetch("/api/admin/alumni/crm/overview", { credentials: "include" }),
          fetch("/api/admin/alumni/crm/segments", { credentials: "include" }),
          fetch("/api/admin/alumni/crm/top-engaged?limit=12", { credentials: "include" }),
          fetch("/api/admin/alumni/crm/inactive?limit=12", { credentials: "include" }),
        ]);
        const [oj, sj, tj, ij] = await Promise.all([o.json(), s.json(), t.json(), i.json()]);
        if (!m) return;
        if (oj.ok && oj.data) setOverview(oj.data);
        if (sj.ok && sj.items) setSegments(sj.items);
        if (tj.ok && tj.items) setTop(tj.items);
        if (ij.ok && ij.items) setInactive(ij.items);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const recompute = async () => {
    setLog(null);
    const res = await fetch("/api/admin/alumni/crm/recompute", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 80 }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; message?: string };
    if (json.ok) {
      setLog("تم إرسال طلب إعادة الحساب — سيتم تحديث الصفحة.");
    } else {
      setLog(`تعذر التنفيذ: ${json.error || json.message || "خطأ غير معروف"}`);
    }
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">CRM الخريجين</h1>
          <p className="mt-1 text-sm text-slate-600">
            تصنيفات تعتمد على نشاط الإرشاد، الفعاليات، البريد، والملف — يُحدَّث عبر إعادة الحساب الدفعية.
          </p>
        </div>
        <button type="button" onClick={() => void recompute()} className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white">
          إعادة حساب المجموعة
        </button>
      </div>
      {log ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
          {log}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">إجمالي الخريجين</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{overview?.alumniTotal ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">متوسط نقاط العلاقة</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{overview?.avgScore ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">مهام أتمتة معلّقة</p>
          <p className="mt-2 text-3xl font-black tabular-nums">{overview?.jobsPending ?? "—"}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">شرائح التصنيف</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {segments.map((s) => (
            <li key={s.segment} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="font-bold text-slate-800">{segmentLabelAr(s.segment)}</span>
              <span className="text-slate-600">
                {s.count} · متوسط {s.avgScore}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">أعلى الخريجين نشاطًا</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {top.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span className="font-bold">{u.fullName}</span>
                <span className="tabular-nums text-slate-500">{u.reputationScore}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">خريجون غير نشطين</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {inactive.map((u) => (
              <li key={u.id} className="flex justify-between gap-2">
                <span className="font-bold">{u.fullName}</span>
                <span className="text-xs text-slate-500">{u.lastLoginAt || "بدون دخول"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
