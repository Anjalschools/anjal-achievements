"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import type { ExecutiveAlumniDashboard } from "@/lib/alumni/executive-alumni-dashboard";
import CommunityFeedList from "@/components/alumni/CommunityFeedList";
import type { CommunityFeedItem } from "@/lib/alumni/community-feed-service";
import { Activity, BarChart3, FileSpreadsheet, LayoutGrid, ShieldAlert, TrendingUp, Users } from "lucide-react";

const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Users;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </div>
  </div>
);

export default function AdminAlumniExecutiveDashboardPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [dash, setDash] = useState<ExecutiveAlumniDashboard | null>(null);
  const [feed, setFeed] = useState<CommunityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let m = true;
    void (async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/alumni/executive-dashboard", { credentials: "include" });
        const j = (await res.json()) as { ok?: boolean; data?: ExecutiveAlumniDashboard };
        if (!res.ok || !j.ok || !j.data) {
          if (m) setError(isAr ? "تعذر تحميل لوحة التحكم." : "Could not load executive dashboard.");
          return;
        }
        if (m) setDash(j.data);
      } catch {
        if (m) setError(isAr ? "تعذر تحميل لوحة التحكم." : "Could not load executive dashboard.");
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [isAr]);

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/community-feed", { credentials: "include" });
        const j = (await res.json()) as { ok?: boolean; items?: CommunityFeedItem[] };
        if (m && j.ok && Array.isArray(j.items)) setFeed(j.items.slice(0, 8));
      } finally {
        if (m) setFeedLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const o = dash?.overview;
  const eg = dash?.engagement;
  const health = dash?.communityHealth;

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "لوحة مجتمع الخريجين التنفيذية" : "Alumni executive dashboard"}
        subtitle={
          isAr
            ? "مؤشرات حية للنمو والتوثيق والتفاعل وصحة المجتمع — مع معاينة لتغذية النشاط."
            : "Live KPIs for growth, verification, engagement, and community health — plus an activity feed preview."
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      {loading || !o ? (
        <div className="py-16 text-center text-sm text-slate-500">{isAr ? "جاري التحميل…" : "Loading…"}</div>
      ) : (
        <>
          <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Users}
              label={isAr ? "إجمالي الخريجين" : "Total alumni"}
              value={o.alumniCount}
              hint={
                dash?.snapshotTrend.alumniCountDelta != null
                  ? isAr
                    ? `أسبوعي: ${dash.snapshotTrend.alumniCountDelta > 0 ? "+" : ""}${dash.snapshotTrend.alumniCountDelta} (لقطة)`
                    : `Weekly snapshot Δ: ${dash.snapshotTrend.alumniCountDelta > 0 ? "+" : ""}${dash.snapshotTrend.alumniCountDelta}`
                  : isAr
                    ? "لقطات أسبوعية غير متوفرة بعد"
                    : "Weekly snapshots not available yet"
              }
            />
            <StatCard
              icon={ShieldAlert}
              label={isAr ? "نسبة التوثيق" : "Verification rate"}
              value={`${dash?.verificationRatePercent ?? 0}%`}
              hint={isAr ? `${o.alumniVerifiedCount} موثّق` : `${o.alumniVerifiedCount} verified`}
            />
            <StatCard
              icon={TrendingUp}
              label={isAr ? "تسجيل (7 أيام)" : "Sign-ups (7d)"}
              value={dash?.registration.last7d ?? 0}
              hint={
                dash?.registration.deltaPercent != null
                  ? isAr
                    ? `مقارنة بالأسبوع السابق: ${dash.registration.deltaPercent}%`
                    : `vs prior week: ${dash.registration.deltaPercent}%`
                  : undefined
              }
            />
            <StatCard
              icon={Activity}
              label={isAr ? "معدل حضور الفعاليات" : "Event RSVP “going” rate"}
              value={`${eg?.attendanceRatePercent ?? 0}%`}
              hint={isAr ? `${eg?.rsvpGoing ?? 0} مؤكد / ${eg?.rsvpTotal ?? 0} إجمالي` : `${eg?.rsvpGoing ?? 0} going / ${eg?.rsvpTotal ?? 0} total`}
            />
          </section>

          <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={BarChart3}
              label={isAr ? "متوسط السمعة" : "Avg reputation"}
              value={dash?.avgReputation ?? 0}
              hint={isAr ? "على ملفات الخريجين النشطة" : "Across active alumni profiles"}
            />
            <StatCard
              icon={LayoutGrid}
              label={isAr ? "اكتمال الملف" : "Profile depth"}
              value={`${dash?.profileCompletionRatePercent ?? 0}%`}
              hint={isAr ? "6 حقول رئيسية مكتملة" : "Six core fields completed"}
            />
            <StatCard
              icon={Users}
              label={isAr ? "طلبات إرشاد (30 يومًا)" : "Mentorship requests (30d)"}
              value={eg?.mentorshipRequestsLast30d ?? 0}
              hint={isAr ? `إجمالي سجلات الإرشاد: ${o.mentorshipTotal}` : `All mentorship rows: ${o.mentorshipTotal}`}
            />
            <StatCard
              icon={FileSpreadsheet}
              label={isAr ? "قصص منشورة" : "Published stories"}
              value={o.storiesPublished}
              hint={isAr ? `ذكريات معتمدة: ${o.memoryStatusCounts.approved}` : `Approved memories: ${o.memoryStatusCounts.approved}`}
            />
          </section>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">
                {isAr ? "أقوى الجامعات" : "Top universities"}
              </h2>
              <ul className="space-y-2 text-sm">
                {o.topUniversities.slice(0, 6).map((u) => (
                  <li key={u.name} className="flex justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
                    <span className="truncate font-semibold text-slate-900">{u.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-600">
                      {u.count}
                      <span className="text-xs text-slate-400"> · {u.verifiedCount}✓</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">
                {isAr ? "أكثر الدول نشاطًا" : "Most active countries"}
              </h2>
              <ul className="space-y-2 text-sm">
                {(dash?.topCountries || []).length ? (
                  dash!.topCountries.map((c) => (
                    <li key={c.name} className="flex justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
                      <span className="truncate font-semibold text-slate-900">{c.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-600">{c.count}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">{isAr ? "لا بيانات دولة بعد." : "No country data yet."}</li>
                )}
              </ul>
            </section>
          </div>

          <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-950">
              <ShieldAlert className="h-4 w-4" aria-hidden />
              {isAr ? "صحة المجتمع" : "Community health"}
            </h2>
            <ul className="grid gap-2 text-xs text-amber-950 sm:grid-cols-2">
              <li>
                {isAr ? "طابور الإشراف:" : "Moderation backlog:"}{" "}
                <strong>{health?.moderationBacklog ?? 0}</strong>
              </li>
              <li>
                {isAr ? "تذاكر توثيق معلقة:" : "Verification tickets pending:"}{" "}
                <strong>{health?.verificationBacklog ?? 0}</strong>
              </li>
              <li>
                {isAr ? "خريجون غير نشطين (~90d):" : "Dormant alumni (~90d):"}{" "}
                <strong>{health?.dormantAlumniApproxPercent ?? 0}%</strong>
              </li>
              <li>
                {isAr ? "إرشاد ضعيف:" : "Low mentorship signal:"}{" "}
                <strong>{health?.lowMentorshipActivity ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No"}</strong>
              </li>
              <li>
                {isAr ? "تفاعل فعاليات ضعيف:" : "Weak event engagement:"}{" "}
                <strong>{health?.weakEventEngagement ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No"}</strong>
              </li>
              <li>
                {isAr ? "دفعات صغيرة:" : "Small cohorts:"}{" "}
                <strong>{(health?.staleCohortYears || []).length}</strong>
              </li>
            </ul>
            {health?.notesEn?.length || health?.notesAr?.length ? (
              <ul className="mt-3 space-y-1 border-t border-amber-200/80 pt-3 text-xs font-semibold text-amber-950">
                {(isAr ? health?.notesAr : health?.notesEn)?.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">
                {isAr ? "معاينة التغذية" : "Feed preview"}
              </h2>
              <Link
                href="/admin/alumni/community-feed"
                className="mb-3 inline-block text-xs font-bold text-teal-700 underline"
              >
                {isAr ? "فتح التغذية كاملة ←" : "Open full feed →"}
              </Link>
              <CommunityFeedList
                items={feed}
                loading={feedLoading}
                isAr={isAr}
                emptyLabelAr="لا عناصر."
                emptyLabelEn="No items."
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">
                {isAr ? "فرص وذكريات" : "Opportunities & memories"}
              </h2>
              <ul className="space-y-2 text-sm text-slate-800">
                <li className="flex justify-between">
                  <span>{isAr ? "فرص قيد المراجعة" : "Opps pending review"}</span>
                  <strong>{o.opportunityCounts.pendingReview}</strong>
                </li>
                <li className="flex justify-between">
                  <span>{isAr ? "فرص عامة" : "Public opportunities"}</span>
                  <strong>{o.opportunityCounts.approvedPublic}</strong>
                </li>
                <li className="flex justify-between">
                  <span>{isAr ? "ذكريات معلقة" : "Memories pending"}</span>
                  <strong>{o.memoryStatusCounts.pending}</strong>
                </li>
                <li className="flex justify-between">
                  <span>{isAr ? "ذكريات مرفوضة" : "Memories rejected"}</span>
                  <strong>{o.memoryStatusCounts.rejected}</strong>
                </li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/admin/alumni/reports"
                  className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"
                >
                  {isAr ? "التقارير" : "Reports"}
                </Link>
                <Link
                  href="/admin/alumni/analytics"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                >
                  {isAr ? "تحليلات أعمق" : "Deeper analytics"}
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
