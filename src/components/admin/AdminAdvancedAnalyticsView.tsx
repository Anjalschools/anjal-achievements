"use client";

import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import { Loader2, PieChart, TrendingUp, Users, BarChart3, Lightbulb, GitCompare, Sparkles } from "lucide-react";
import type { AdminAnalyticsRecommendation, AdminInsightItem, AdvancedLabeledRow } from "@/lib/admin-advanced-analytics-types";
import {
  labelInsightPriority,
  labelRecommendationCategory,
  labelRecommendationPriority,
} from "@/lib/admin-advanced-analytics-labels";

type AdvancedPayload = {
  scopeYear: number;
  summary: {
    yearAchievementCount: number;
    approvedShareOfYearPct: number | null;
    featuredShareOfApprovedPct: number | null;
    avgApprovedPerActiveStudent: number | null;
    activeStudentsWithApprovedInYear: number;
  };
  comparison: {
    approvedInArabicTrack: number;
    approvedInInternationalTrack: number;
    approvedUnspecifiedTrack: number;
    ratioArabicToInternational: number | null;
  };
  breakdowns: {
    gender: AdvancedLabeledRow[];
    track: AdvancedLabeledRow[];
    grade: AdvancedLabeledRow[];
    stage: AdvancedLabeledRow[];
    achievementType: AdvancedLabeledRow[];
    achievementLevel: AdvancedLabeledRow[];
    inferredField: AdvancedLabeledRow[];
  };
  statusMix: AdvancedLabeledRow[];
  trends: {
    byAchievementYear: Array<{ year: number; total: number; approved: number }>;
    byMonthInScopeYear: Array<{ month: number; labelAr: string; labelEn: string; count: number }>;
  };
  narrativeInsights: string[];
  recommendations: AdminAnalyticsRecommendation[];
};

type OverviewResponse = {
  overview?: {
    year?: number;
    advanced?: AdvancedPayload;
  };
};

const BarRow = ({
  row,
  maxPct,
  label,
}: {
  row: AdvancedLabeledRow;
  maxPct: number;
  label: string;
}) => {
  const w = maxPct > 0 ? Math.max(8, (row.pct / maxPct) * 100) : 0;
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-0">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 flex-1 font-medium text-slate-800">{label}</span>
        <span className="shrink-0 tabular-nums text-slate-600">
          {row.count}{" "}
          <span className="text-xs text-slate-400">({row.pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-l from-sky-600 to-sky-500 transition-all"
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
};

const SectionCard = ({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: typeof BarChart3;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

const AdminAdvancedAnalyticsView = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState<AdvancedPayload | null>(null);
  const [insights, setInsights] = useState<AdminInsightItem[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [oRes, iRes] = await Promise.all([
          fetch("/api/admin/analytics/overview", { cache: "no-store" }),
          fetch("/api/admin/analytics/insights", { cache: "no-store" }),
        ]);
        const oJson = (await oRes.json()) as OverviewResponse & { error?: string };
        const iJson = (await iRes.json()) as { insights?: AdminInsightItem[]; error?: string };
        if (!oRes.ok) throw new Error(typeof oJson.error === "string" ? oJson.error : "overview");
        if (!iRes.ok) throw new Error(typeof iJson.error === "string" ? iJson.error : "insights");
        const adv = oJson.overview?.advanced;
        const parsed =
          adv && typeof adv === "object"
            ? ({
                ...adv,
                recommendations: Array.isArray((adv as AdvancedPayload).recommendations)
                  ? (adv as AdvancedPayload).recommendations
                  : [],
              } as AdvancedPayload)
            : null;
        setAdvanced(parsed);
        setInsights(Array.isArray(iJson.insights) ? iJson.insights : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
        setAdvanced(null);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (error || !advanced) {
    return (
      <PageContainer>
        <p className="text-sm text-rose-600">
          {isAr ? "تعذر تحميل التحليلات المتقدمة." : "Could not load advanced analytics."}{" "}
          {error ? `(${error})` : ""}
        </p>
      </PageContainer>
    );
  }

  const s = advanced.summary;
  const maxStatusPct = Math.max(0, ...advanced.statusMix.map((r) => r.pct));
  const maxGenderPct = Math.max(0, ...advanced.breakdowns.gender.map((r) => r.pct));
  const maxTrackPct = Math.max(0, ...advanced.breakdowns.track.map((r) => r.pct));
  const maxGradePct = Math.max(0, ...advanced.breakdowns.grade.map((r) => r.pct));
  const maxStagePct = Math.max(0, ...advanced.breakdowns.stage.map((r) => r.pct));
  const maxTypePct = Math.max(0, ...advanced.breakdowns.achievementType.map((r) => r.pct));
  const maxLevelPct = Math.max(0, ...advanced.breakdowns.achievementLevel.map((r) => r.pct));
  const maxFieldPct = Math.max(0, ...advanced.breakdowns.inferredField.map((r) => r.pct));

  const monthMax = Math.max(0, ...advanced.trends.byMonthInScopeYear.map((m) => m.count));
  const yearRows = advanced.trends.byAchievementYear;

  const label = (row: AdvancedLabeledRow) => (isAr ? row.labelAr : row.labelEn);

  const emptyBreakdown = (rows: AdvancedLabeledRow[]) => rows.length === 0;

  return (
    <PageContainer>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-black text-slate-900">
          {isAr ? "الإحصاءات المتقدمة" : "Advanced analytics"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          {isAr
            ? "تحليل تفصيلي لتوزيع الإنجازات ومقارنات المسارات واتجاهات الأعوام الدراسية — مخصص للقرار التحليلي، وليس كبديل عن لوحة التنفيذ السريعة."
            : "Deep distributions, track comparisons, and year trends — for analytical decisions, not the executive dashboard."}
        </p>
        <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {isAr ? `نطاق السنة المسجّلة: ${advanced.scopeYear}` : `Scoped year: ${advanced.scopeYear}`}
        </p>
      </header>

      {s.yearAchievementCount === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-14 text-center">
          <p className="text-lg font-bold text-slate-800">
            {isAr ? "لا توجد بيانات كافية في نطاق العام الحالي" : "Insufficient data for the current scope year"}
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            {isAr
              ? "لم يُسجّل أي إنجاز ضمن سنة العام الدراسي الحالية في النظام — ستظهر التوزيعات والاتجاهات تلقائيًا عند توفر السجلات."
              : "No achievements are recorded for the current academic year scope yet."}
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
          <p className="text-xs font-bold text-indigo-900/80">
            {isAr ? "نسبة المعتمد من إجمالي نطاق العام" : "Approved share of year scope"}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-indigo-950">
            {s.approvedShareOfYearPct != null ? `${s.approvedShareOfYearPct}%` : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
          <p className="text-xs font-bold text-violet-900/80">
            {isAr ? "نسبة المميز من المعتمد" : "Featured share of approved"}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-violet-950">
            {s.featuredShareOfApprovedPct != null ? `${s.featuredShareOfApprovedPct}%` : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <p className="text-xs font-bold text-emerald-900/80">
            {isAr ? "متوسط إنجازات معتمدة لكل طالب نشط" : "Avg approved per active student"}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-emerald-950">
            {s.avgApprovedPerActiveStudent != null ? String(s.avgApprovedPerActiveStudent) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-emerald-800/80">
            {isAr ? `طلاب نشطون: ${s.activeStudentsWithApprovedInYear}` : `Active students: ${s.activeStudentsWithApprovedInYear}`}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-600">{isAr ? "إجمالي إنجازات نطاق العام" : "Total in year scope"}</p>
          <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{s.yearAchievementCount}</p>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={isAr ? "خلط حالات سير العمل (كل السجلات)" : "Workflow mix (all records)"}
          subtitle={isAr ? "توزيع الحالات المعتمدة والمراجعة والرفض" : "Pending, approved, featured, rejected"}
          icon={PieChart}
        >
          {emptyBreakdown(advanced.statusMix) ? (
            <p className="text-sm text-slate-500">{isAr ? "لا بيانات" : "No data"}</p>
          ) : (
            advanced.statusMix.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxStatusPct} label={label(row)} />
            ))
          )}
        </SectionCard>

        <SectionCard
          title={isAr ? "مقارنة المسارات (معتمد — نطاق العام)" : "Track comparison (approved, year scope)"}
          subtitle={isAr ? "العربي مقابل الدولي ضمن الإنجازات المعتمدة" : "Arabic vs international"}
          icon={GitCompare}
        >
          <div className="space-y-3 text-sm">
            <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>{isAr ? "المسار العربي" : "Arabic track"}</span>
              <span className="font-bold tabular-nums">{advanced.comparison.approvedInArabicTrack}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>{isAr ? "المسار الدولي" : "International"}</span>
              <span className="font-bold tabular-nums">{advanced.comparison.approvedInInternationalTrack}</span>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span>{isAr ? "غير محدد" : "Unspecified"}</span>
              <span className="font-bold tabular-nums">{advanced.comparison.approvedUnspecifiedTrack}</span>
            </div>
            {advanced.comparison.ratioArabicToInternational != null ? (
              <p className="text-xs text-slate-600">
                {isAr
                  ? `نسبة العربي إلى الدولي (عددًا): ${advanced.comparison.ratioArabicToInternational}`
                  : `Arabic / international ratio: ${advanced.comparison.ratioArabicToInternational}`}
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <h2 className="mt-12 text-lg font-black text-slate-900">
        {isAr ? "تحليلات التوزيع (معتمد — نطاق العام)" : "Distribution analysis (approved, year scope)"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {isAr
          ? "تفريعات تفصيلية: الجنس، المسار، المرحلة، الصف، نوع الإدخال، مستوى الإنجاز، المجال."
          : "Gender, track, stage, grade, type, level, field."}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title={isAr ? "الجنس" : "Gender"} icon={Users}>
          {emptyBreakdown(advanced.breakdowns.gender) ? (
            <EmptyHint isAr={isAr} />
          ) : (
            advanced.breakdowns.gender.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxGenderPct} label={label(row)} />
            ))
          )}
        </SectionCard>
        <SectionCard title={isAr ? "المسار الدراسي" : "Track"} icon={BarChart3}>
          {emptyBreakdown(advanced.breakdowns.track) ? (
            <EmptyHint isAr={isAr} />
          ) : (
            advanced.breakdowns.track.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxTrackPct} label={label(row)} />
            ))
          )}
        </SectionCard>
        <SectionCard title={isAr ? "المرحلة" : "Stage"} icon={BarChart3}>
          {emptyBreakdown(advanced.breakdowns.stage) ? (
            <EmptyHint isAr={isAr} />
          ) : (
            advanced.breakdowns.stage.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxStagePct} label={label(row)} />
            ))
          )}
        </SectionCard>
        <SectionCard title={isAr ? "الصف" : "Grade"} icon={BarChart3}>
          {emptyBreakdown(advanced.breakdowns.grade) ? (
            <EmptyHint isAr={isAr} />
          ) : (
            advanced.breakdowns.grade.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxGradePct} label={label(row)} />
            ))
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title={isAr ? "نوع الإنجاز / البرنامج" : "Achievement type"} icon={BarChart3}>
          {emptyBreakdown(advanced.breakdowns.achievementType) ? (
            <EmptyHint isAr={isAr} />
          ) : (
            advanced.breakdowns.achievementType.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxTypePct} label={label(row)} />
            ))
          )}
        </SectionCard>
        <SectionCard title={isAr ? "مستوى الإنجاز" : "Level"} icon={BarChart3}>
          {emptyBreakdown(advanced.breakdowns.achievementLevel) ? (
            <EmptyHint isAr={isAr} />
          ) : (
            advanced.breakdowns.achievementLevel.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxLevelPct} label={label(row)} />
            ))
          )}
        </SectionCard>
        <SectionCard title={isAr ? "المجال (المستنتج)" : "Field (inferred)"} icon={BarChart3}>
          {emptyBreakdown(advanced.breakdowns.inferredField) ? (
            <EmptyHint isAr={isAr} />
          ) : (
            advanced.breakdowns.inferredField.map((row) => (
              <BarRow key={row.key} row={row} maxPct={maxFieldPct} label={label(row)} />
            ))
          )}
        </SectionCard>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={isAr ? "اتجاه الأعوام الدراسية" : "Trend by academic year"}
          subtitle={isAr ? "إجمالي السجلات مقابل المعتمد لكل عام مسجّل" : "Total vs approved per year"}
          icon={TrendingUp}
        >
          {yearRows.length === 0 ? (
            <EmptyHint isAr={isAr} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-right text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="py-2 font-semibold">{isAr ? "العام" : "Year"}</th>
                    <th className="py-2 font-semibold">{isAr ? "الإجمالي" : "Total"}</th>
                    <th className="py-2 font-semibold">{isAr ? "المعتمد" : "Approved"}</th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map((r) => (
                    <tr key={r.year} className="border-b border-slate-100">
                      <td className="py-2 font-medium tabular-nums">{r.year}</td>
                      <td className="py-2 tabular-nums">{r.total}</td>
                      <td className="py-2 tabular-nums text-emerald-800">{r.approved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={isAr ? "توزيع شهري ضمن نطاق العام" : "Monthly spread (scope year)"}
          subtitle={isAr ? "حسب تاريخ تسجيل الإنجاز عند توفره" : "By achievement date when present"}
          icon={TrendingUp}
        >
          {advanced.trends.byMonthInScopeYear.every((m) => m.count === 0) ? (
            <p className="text-sm text-slate-500">
              {isAr
                ? "لا توجد تواريخ كافية لعرض توزيع شهري — أو لا توجد إنجازات في نطاق العام."
                : "Not enough dates for a monthly view."}
            </p>
          ) : (
            <div className="space-y-2">
              {advanced.trends.byMonthInScopeYear.map((m) => {
                const w = monthMax > 0 ? Math.max(6, (m.count / monthMax) * 100) : 0;
                return (
                  <div key={m.month} className="flex items-center gap-2 text-sm">
                    <span className="w-16 shrink-0 text-xs text-slate-600">{isAr ? m.labelAr : m.labelEn}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-600"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 tabular-nums text-slate-800">{m.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {advanced.narrativeInsights.length > 0 ? (
        <section className="mt-10 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-800" aria-hidden />
            <h2 className="text-lg font-black text-amber-950">
              {isAr ? "رؤى تحليلية من البيانات" : "Data-driven narrative"}
            </h2>
          </div>
          <ul className="list-inside list-disc space-y-3 text-sm leading-relaxed text-amber-950/90">
            {advanced.narrativeInsights.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {s.yearAchievementCount > 0 && advanced.recommendations.length > 0 ? (
        <section className="mt-10 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/35 via-white to-white p-6 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-800" aria-hidden />
            <h2 className="text-lg font-black text-violet-950">
              {isAr
                ? "توصيات الذكاء الاصطناعي للمسابقات والبرامج"
                : "AI-style recommendations for competitions & programs"}
            </h2>
          </div>
          <p className="mb-5 max-w-3xl text-xs leading-relaxed text-slate-600">
            {isAr
              ? "خطوات تشغيلية مقترحة من مؤشرات المنصة نفسها (قواعد تحليل مدمجة) — تكمّل الرؤى أعلاه وتجيب عن: ماذا نفعل بعد قراءة الأرقام؟"
              : "Action items derived from the same platform metrics (rule-based) — complements the narrative above with what to do next."}
          </p>
          <div className="space-y-4">
            {advanced.recommendations.map((rec) => {
              const shell =
                rec.priority === "high"
                  ? "border-amber-200/90 bg-amber-50/40"
                  : rec.priority === "medium"
                    ? "border-sky-200/90 bg-sky-50/35"
                    : "border-slate-200/90 bg-slate-50/60";
              return (
                <article
                  key={rec.id}
                  className={`rounded-xl border p-4 shadow-sm ${shell}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 ring-1 ring-slate-200/80">
                      {labelRecommendationPriority(rec.priority, isAr)}
                    </span>
                    <span className="inline-flex rounded-full bg-violet-100/90 px-2.5 py-0.5 text-[10px] font-bold text-violet-950 ring-1 ring-violet-200/80">
                      {labelRecommendationCategory(rec.category, isAr)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-900">
                    {isAr ? rec.titleAr : rec.titleEn}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-800">
                    {isAr ? rec.descriptionAr : rec.descriptionEn}
                  </p>
                  {rec.nextStepAr || rec.nextStepEn ? (
                    <div className="mt-3 border-t border-slate-200/70 pt-3">
                      <p className="text-[11px] font-bold text-slate-600">
                        {isAr ? "خطوة مقترحة" : "Suggested next step"}
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {isAr ? rec.nextStepAr : rec.nextStepEn}
                      </p>
                    </div>
                  ) : null}
                  {rec.relatedLabelsAr && rec.relatedLabelsAr.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rec.relatedLabelsAr.map((lb, j) => (
                        <span
                          key={`${rec.id}-lb-${j}`}
                          className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/70"
                        >
                          {lb}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-black text-slate-900">{isAr ? "رؤى تشغيلية ذكية" : "Operational insights"}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isAr
            ? "تنبيهات وفرص مستخرجة من السجلات — مكمّلة للتحليل أعلاه، وليست نسخة من ملخص لوحة الإدارة."
            : "Alerts and opportunities from records — complementary to the analysis above."}
        </p>
        <div className="mt-4 space-y-3">
          {insights.length === 0 ? (
            <p className="text-sm text-slate-500">{isAr ? "لا توجد رؤى إضافية حالياً" : "No additional insights"}</p>
          ) : (
            insights.map((it, idx) => (
              <div
                key={`${it.type}-${idx}`}
                className={`rounded-xl border p-4 ${
                  it.priority === "high"
                    ? "border-amber-300 bg-amber-50/90"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                <p className="font-bold text-slate-900">{it.titleAr}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{it.descriptionAr}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {isAr ? "درجة الأولوية: " : "Priority: "}
                  {labelInsightPriority(it.priority, isAr)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </PageContainer>
  );
};

const EmptyHint = ({ isAr }: { isAr: boolean }) => (
  <p className="text-sm text-slate-500">
    {isAr ? "لا توجد بيانات كافية لهذا القسم حاليًا." : "Not enough data for this breakdown."}
  </p>
);

export default AdminAdvancedAnalyticsView;
