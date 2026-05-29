"use client";

import { useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import {
  buildHallOfFameShowcase,
  getBadgeLabel,
  type StudentHallOfFameEntry,
} from "@/lib/analytics/student-intelligence-insights";
import {
  formatMedalCount,
  formatParticipationCount,
  t,
  type AnalyticsLocale,
} from "@/lib/analytics/analytics-semantic-registry";
import { useAnalyticsPerspectiveOptional } from "@/lib/analytics/analytics-perspective-context";

export type HallOfFameIntelligenceProps = {
  isAr: boolean;
  data: StudentIntelligencePayload | null;
  generalData: ParticipationAnalyticsPayload | null;
  loading?: boolean;
  executiveMode?: boolean;
  onSelectStudent?: (participantId: string) => void;
  maxCards?: number;
};

const locOf = (isAr: boolean): AnalyticsLocale => (isAr ? "ar" : "en");

const MedalStrip = ({ count, loc }: { count: number; loc: AnalyticsLocale }) => (
  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-950 tabular-nums">
    🥇🥈🥉 {formatMedalCount(count, loc)}
  </span>
);

const BadgeChip = ({
  badge,
  loc,
  variant = "default",
}: {
  badge: StudentHallOfFameEntry["badges"][number];
  loc: AnalyticsLocale;
  variant?: "hero" | "default";
}) => (
  <span
    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
      variant === "hero"
        ? "bg-white/20 text-white ring-1 ring-white/30"
        : "bg-indigo-50 text-indigo-900"
    }`}
  >
    {getBadgeLabel(badge, loc)}
  </span>
);

const HeroStudentCard = ({
  entry,
  isAr,
  loc,
  topActivity,
  conversionPct,
  onSelect,
}: {
  entry: StudentHallOfFameEntry;
  isAr: boolean;
  loc: AnalyticsLocale;
  topActivity: string;
  conversionPct: number;
  onSelect?: (id: string) => void;
}) => {
  const { row } = entry;
  const name = isAr ? row.nameAr : row.nameEn;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.participantId)}
      className="group relative w-full overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 p-5 text-start text-white shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 sm:p-6"
    >
      <div className="pointer-events-none absolute -end-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition group-hover:bg-white/15" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatarUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-4 ring-white/25 sm:h-24 sm:w-24"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black sm:h-24 sm:w-24">
            {name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">
              {t("hall.hero.rank", loc)}
            </span>
            {entry.badges.slice(0, 4).map((b) => (
              <BadgeChip key={`${row.participantId}-hero-${b}`} badge={b} loc={loc} variant="hero" />
            ))}
          </div>
          <h3 className="mt-2 truncate text-xl font-black tracking-tight sm:text-2xl" dir="auto">
            {name}
          </h3>
          <p className="mt-1 text-sm text-indigo-100/90" dir="auto">
            {isAr ? row.stageLabelAr : row.stageLabelEn} ·{" "}
            {row.sectionKey === "international" ? (isAr ? "دولي" : "Intl.") : isAr ? "عربي" : "Arabic"} ·{" "}
            {row.mawhiba ? (isAr ? "موهبة" : "Mawhiba") : isAr ? "غير موهبة" : "Non-Mawhiba"}
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-indigo-50">
            {isAr ? entry.narrativeAr : entry.narrativeEn}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-white/15 px-2.5 py-1 tabular-nums">
              {formatParticipationCount(row.recordCount, loc)}
            </span>
            <span className="rounded-lg bg-white/15 px-2.5 py-1 tabular-nums">
              {formatMedalCount(row.medalCount, loc)}
            </span>
            <span className="rounded-lg bg-white/15 px-2.5 py-1 tabular-nums">
              {t("kpi.medalConversion", loc)} {row.medalRatioPct}%
            </span>
            <span className="rounded-lg bg-white/10 px-2.5 py-1 opacity-90">{topActivity}</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-indigo-200/80 print:hidden">
        {isAr ? "معدل التحويل العام" : "Scope conversion"}: {conversionPct}%
      </p>
    </button>
  );
};

const PrestigeCard = ({
  entry,
  isAr,
  loc,
  onSelect,
}: {
  entry: StudentHallOfFameEntry;
  isAr: boolean;
  loc: AnalyticsLocale;
  onSelect?: (id: string) => void;
}) => {
  const { row } = entry;
  const rankLabel = isAr ? `#${entry.rank + 1}` : `#${entry.rank + 1}`;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(row.participantId)}
      className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-start shadow-sm transition hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 sm:p-4"
    >
      <div className="flex items-start gap-3">
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatarUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-slate-100"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-indigo-800">
            {(isAr ? row.nameAr : row.nameEn).slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
              {rankLabel}
            </span>
            {entry.badges.slice(0, 2).map((b) => (
              <BadgeChip key={`${row.participantId}-prestige-${b}`} badge={b} loc={loc} />
            ))}
          </div>
          <p className="mt-1 truncate text-sm font-black text-slate-900" dir="auto">
            {isAr ? row.nameAr : row.nameEn}
          </p>
          <p className="text-[10px] text-slate-500" dir="auto">
            {isAr ? row.stageLabelAr : row.stageLabelEn}
          </p>
        </div>
      </div>
      <p className="line-clamp-2 text-[11px] leading-snug text-slate-600">
        {isAr ? entry.narrativeAr : entry.narrativeEn}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <MedalStrip count={row.medalCount} loc={loc} />
        <span className="rounded-lg bg-slate-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700">
          {formatParticipationCount(row.recordCount, loc)}
        </span>
        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-900">
          {row.medalRatioPct}%
        </span>
      </div>
    </button>
  );
};

const HallOfFameIntelligence = ({
  isAr,
  data,
  generalData,
  loading,
  executiveMode = false,
  onSelectStudent,
  maxCards = 12,
}: HallOfFameIntelligenceProps) => {
  const loc = locOf(isAr);
  const perspectiveCtx = useAnalyticsPerspectiveOptional();
  const perspective = perspectiveCtx?.perspective ?? "participation";

  const showcase = useMemo(() => {
    const ctx = {
      topActivityLabelAr: generalData?.kpis.topProgramLabelAr ?? "",
      topActivityLabelEn: generalData?.kpis.topProgramLabelEn ?? "",
      locale: loc,
    };
    return buildHallOfFameShowcase(data, ctx, maxCards);
  }, [data, generalData, loc, maxCards]);

  const conversionPct = generalData
    ? Math.round(
        ((generalData.charts.resultOutcomeCompare
          .filter((x) => ["gold", "silver", "bronze"].includes(x.key))
          .reduce((s, x) => s + x.count, 0) || 0) /
          Math.max(1, generalData.kpis.totalParticipations)) *
          1000
      ) / 10
    : 0;

  const topActivity = isAr
    ? generalData?.kpis.topProgramLabelAr ?? "—"
    : generalData?.kpis.topProgramLabelEn ?? "—";

  if (loading) {
    return (
      <p className="text-sm text-slate-500" aria-live="polite">
        {isAr ? "جاري تحميل قاعة التميز…" : "Loading excellence hall…"}
      </p>
    );
  }

  if (!showcase.hero) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {isAr ? "لا يوجد طلاب ضمن الفلاتر الحالية." : "No students under current filters."}
      </p>
    );
  }

  const gridCols = executiveMode
    ? "grid-cols-1 sm:grid-cols-2"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="space-y-4">
      {perspectiveCtx ? (
        <p className="text-[10px] font-semibold text-indigo-700">
          {perspectiveCtx.label} ·{" "}
          {perspective === "student"
            ? isAr
              ? "ترتيب حسب الطلاب المشاركين"
              : "Ranked by participating students"
            : perspective === "achievement"
              ? isAr
                ? "ترتيب حسب الإنجازات"
                : "Ranked by achievements"
              : isAr
                ? "ترتيب حسب المشاركات"
                : "Ranked by participations"}
        </p>
      ) : null}
      <HeroStudentCard
        entry={showcase.hero}
        isAr={isAr}
        loc={loc}
        topActivity={topActivity}
        conversionPct={conversionPct}
        onSelect={onSelectStudent}
      />
      {showcase.secondary.length > 0 ? (
        <div className={`grid gap-3 ${gridCols}`}>
          {showcase.secondary.map((entry) => (
            <PrestigeCard
              key={entry.row.participantId}
              entry={entry}
              isAr={isAr}
              loc={loc}
              onSelect={onSelectStudent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default HallOfFameIntelligence;
