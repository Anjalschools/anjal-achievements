"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Award, GraduationCap, Handshake, Loader2, RefreshCw, School, ShieldCheck, Target, Users } from "lucide-react";

type Row = {
  id: string;
  graduationYear: number;
  label: string;
  featured: boolean;
  alumniCount: number;
  verifiedCount: number;
  verificationRatePercent: number;
  avgReputation: number | null;
  mentorCount: number;
  mentorCases: number;
  opportunityCount: number;
  active30Count: number;
  activityRatePercent: number;
  topUniversityName: string;
  topUniversityCount: number;
};

export default function AdminAlumniCohortsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncedYears, setSyncedYears] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alumni/cohorts", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; items?: Row[]; syncedYears?: number };
      if (json.ok && json.items) {
        setItems(json.items);
        setSyncedYears(typeof json.syncedYears === "number" ? json.syncedYears : null);
      } else {
        setItems([]);
        setSyncedYears(null);
      }
    } catch {
      setError("تعذر تحميل الدفعات.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const totalAlumni = items.reduce((s, r) => s + r.alumniCount, 0);

  return (
    <div dir="rtl" className="space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">دفعات الخريجين</h1>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {items.length} دفعة · {totalAlumni} خريج في العرض
            {syncedYears != null ? ` · تمت مزامنة ${syncedYears} سنة من الملفات` : null}
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
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <GraduationCap className="h-12 w-12 text-slate-300" aria-hidden />
          <p className="mt-4 text-lg font-black text-slate-900">لا توجد دفعات بعد</p>
          <p className="mt-2 max-w-md text-sm text-slate-600">عند تسجيل خريجين بسنة تخرج في ملفهم تُبنى الدفعات تلقائيًا من هذه السنة.</p>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">دفعة</p>
                  <p className="text-2xl font-black text-slate-900">{row.graduationYear}</p>
                  {row.label ? <p className="mt-1 text-sm text-slate-600">{row.label}</p> : null}
                </div>
                {row.featured ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">مميز</span>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Users className="h-4 w-4 text-primary" aria-hidden />
                  <div>
                    <p className="font-black text-slate-900">{row.alumniCount}</p>
                    <p className="text-[10px] text-slate-500">خريجون</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                  <div>
                    <p className="font-black text-slate-900">{row.verificationRatePercent}%</p>
                    <p className="text-[10px] text-slate-500">توثيق</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Activity className="h-4 w-4 text-sky-600" aria-hidden />
                  <div>
                    <p className="font-black text-slate-900">{row.activityRatePercent}%</p>
                    <p className="text-[10px] text-slate-500">نشاط 30 يومًا</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Award className="h-4 w-4 text-violet-600" aria-hidden />
                  <div>
                    <p className="font-black text-slate-900">{row.avgReputation != null ? row.avgReputation : "—"}</p>
                    <p className="text-[10px] text-slate-500">متوسط السمعة</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Target className="h-4 w-4 text-orange-600" aria-hidden />
                  <div>
                    <p className="font-black text-slate-900">{row.mentorCount}</p>
                    <p className="text-[10px] text-slate-500">مرشدون (خدمة)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Handshake className="h-4 w-4 text-orange-500" aria-hidden />
                  <div>
                    <p className="font-black text-slate-900">{row.mentorCases}</p>
                    <p className="text-[10px] text-slate-500">حالات إرشاد</p>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <School className="h-4 w-4 text-slate-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">{row.topUniversityName || "—"}</p>
                    <p className="text-[10px] text-slate-500">أكثر جامعات ظهورًا ({row.topUniversityCount})</p>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2">
                  <p className="text-[11px] text-slate-600">
                    فرص مرتبطة بالمنشئين: <span className="font-black text-slate-900">{row.opportunityCount}</span>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
