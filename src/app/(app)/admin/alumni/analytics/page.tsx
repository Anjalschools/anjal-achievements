"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type {
  AdminAlumniOverview,
  UniversitiesIntelRow,
  CareersIntel,
  EngagementIntel,
} from "@/lib/alumni/admin-alumni-analytics";

type Bundle = {
  overview: AdminAlumniOverview | null;
  universities: UniversitiesIntelRow[];
  careers: CareersIntel | null;
  engagement: EngagementIntel | null;
};

type GrowthPoint = {
  periodStart: string;
  alumniCount: number;
  verifiedCount: number;
  mentorshipTotal: number;
  storiesPublished: number;
};

type TrendsData = {
  industryTrend: { periodStart: string; topIndustry: string; count: number }[];
  cohortEvolution: { year: number; count: number; delta: number }[];
  engagement: { latestAttendanceRate: number | null; previousAttendanceRate: number | null };
};

const BarRow = ({ label, value, max }: { label: string; value: number; max: number }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-bold text-slate-600">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-slate-900">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default function AdminAlumniAnalyticsPage() {
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState<GrowthPoint[] | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const [o, u, c, e] = await Promise.all([
          fetch("/api/admin/alumni/analytics/overview", { credentials: "include" }),
          fetch("/api/admin/alumni/analytics/universities", { credentials: "include" }),
          fetch("/api/admin/alumni/analytics/careers", { credentials: "include" }),
          fetch("/api/admin/alumni/analytics/engagement", { credentials: "include" }),
        ]);
        const [oj, uj, cj, ej] = await Promise.all([o.json(), u.json(), c.json(), e.json()]);
        if (!m) return;
        setData({
          overview: oj.ok ? oj.data : null,
          universities: uj.ok && uj.data?.items ? uj.data.items : [],
          careers: cj.ok ? cj.data : null,
          engagement: ej.ok ? ej.data : null,
        });
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const [h, tr] = await Promise.all([
          fetch("/api/admin/alumni/analytics/history?granularity=weekly&limit=24", { credentials: "include" }),
          fetch("/api/admin/alumni/analytics/trends?granularity=weekly&limit=24", { credentials: "include" }),
        ]);
        const [hj, trj] = await Promise.all([h.json(), tr.json()]);
        if (!m) return;
        setHist(hj.ok && hj.data?.series ? (hj.data.series as GrowthPoint[]) : null);
        setTrends(trj.ok ? (trj.data as TrendsData) : null);
      } finally {
        if (m) setHistLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const uniMax = useMemo(
    () => (data?.universities?.length ? Math.max(...data.universities.map((x) => x.alumniCount), 1) : 1),
    [data?.universities]
  );
  const companyMax = useMemo(
    () =>
      data?.careers?.topCompanies?.length
        ? Math.max(...data.careers.topCompanies.map((x) => x.count), 1)
        : 1,
    [data?.careers]
  );

  const growthMax = useMemo(
    () => (hist?.length ? Math.max(...hist.map((x) => x.alumniCount), 1) : 1),
    [hist]
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const ov = data?.overview;
  const eg = data?.engagement;

  return (
    <div dir="rtl" className="space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">تحليلات مجتمع الخريجين</h1>
        <p className="mt-2 text-sm text-slate-600">
          مؤشرات مجمّعة من قاعدة البيانات مع تخزين مؤقت قصير الأمد للأداء.
        </p>
      </div>

      {ov ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "الخريجون", value: ov.alumniCount },
            { label: "خريجون موثّقون", value: ov.alumniVerifiedCount },
            { label: "طلبات الإرشاد", value: ov.mentorshipTotal },
            { label: "قصص منشورة", value: ov.storiesPublished },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">{c.label}</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{c.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">الجامعات</h2>
          <p className="mt-1 text-xs text-slate-500">أكثر الجامعات تمثيلًا ونسب التوثيق التقريبية.</p>
          <div className="mt-4 space-y-3">
            {data?.universities?.slice(0, 10).map((u) => (
              <BarRow key={u.name} label={`${u.name} (${u.verifiedRate}% موثّق)`} value={u.alumniCount} max={uniMax} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">المسارات المهنية</h2>
          <p className="mt-1 text-xs text-slate-500">أكثر الشركات والقطاعات والمسميات الوظيفية.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-bold text-primary">الشركات</p>
              {data?.careers?.topCompanies?.slice(0, 6).map((r) => (
                <BarRow key={r.name} label={r.name} value={r.count} max={companyMax} />
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-bold text-primary">القطاعات</p>
              {data?.careers?.topIndustries?.slice(0, 6).map((r) => (
                <BarRow key={r.name} label={r.name} value={r.count} max={companyMax} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">الذاكرة التاريخية (أسبوعي)</h2>
        <p className="mt-1 text-xs text-slate-500">
          لقطات مجمّعة عبر وظيفة cron — تُملأ بعد تشغيل `/api/cron/alumni-analytics-snapshots`.
        </p>
        {histLoading ? (
          <div className="mt-6 flex min-h-[120px] items-center justify-center text-sm text-slate-500">جاري التحميل…</div>
        ) : hist && hist.length ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-slate-700">نمو الخريجين المسجّل</p>
              <div className="mt-3 space-y-2">
                {hist.slice(-12).map((p) => (
                  <BarRow
                    key={p.periodStart}
                    label={p.periodStart.slice(0, 10)}
                    value={p.alumniCount}
                    max={growthMax}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">أعلى قطاع في كل فترة</p>
              <div className="mt-3 space-y-2">
                {(trends?.industryTrend || []).slice(-10).map((r) => (
                  <BarRow
                    key={r.periodStart + r.topIndustry}
                    label={`${r.periodStart.slice(0, 10)} — ${r.topIndustry}`}
                    value={r.count}
                    max={Math.max(...(trends?.industryTrend || []).map((x) => x.count), 1)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            لا توجد لقطات بعد. جدولة cron مع `CRON_SECRET` لملء السلاسل الزمنية.
          </p>
        )}

        {trends?.cohortEvolution?.length ? (
          <div className="mt-8">
            <p className="text-xs font-bold text-slate-700">تطور حجم الدفعات (أحدث لقطة مقارنة بالسابقة)</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {trends.cohortEvolution.map((c) => (
                <li key={c.year} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-bold">دفعة {c.year}</span>
                  <span className="tabular-nums text-slate-600">
                    {c.count}{" "}
                    <span className={c.delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      ({c.delta >= 0 ? "+" : ""}
                      {c.delta})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">التفاعل والإرشاد</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div>
            <p className="text-xs font-bold text-slate-500">طلبات إرشاد (30 يومًا)</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{eg?.mentorshipRequestsLast30d ?? "—"}</p>
            <p className="mt-3 text-xs font-bold text-slate-500">معدل RSVP (حضور مبدئي)</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{eg ? `${eg.attendanceRatePercent}%` : "—"}</p>
            <p className="mt-1 text-[11px] text-slate-400">حالة «سأحضر» من إجمالي الردود المسجّلة.</p>
          </div>
          <div className="lg:col-span-2">
            <p className="text-xs font-bold text-slate-700">أكثر المجالات طلبًا (فئات الطلبات)</p>
            <div className="mt-2 space-y-2">
              {eg?.mentorshipHotCategories?.slice(0, 8).map((r) => (
                <BarRow
                  key={r.category}
                  label={r.category}
                  value={r.count}
                  max={Math.max(...(eg?.mentorshipHotCategories || []).map((x) => x.count), 1)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-primary">أعلى الخريجين نقاطًا</p>
            <ul className="mt-2 space-y-2 text-sm">
              {eg?.topByReputation?.map((u) => (
                <li key={u.userId} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-bold text-slate-800">{u.fullName || u.userId}</span>
                  <span className="tabular-nums text-slate-600">{u.reputationScore}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold text-primary">مرشدون الأكثر إكمالًا</p>
            <ul className="mt-2 space-y-2 text-sm">
              {eg?.activeMentors?.map((m) => (
                <li key={m.mentorId} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="font-bold text-slate-800">{m.fullName || m.mentorId}</span>
                  <span className="text-slate-600">
                    مكتمل {m.completed} / مقبول {m.accepted}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
