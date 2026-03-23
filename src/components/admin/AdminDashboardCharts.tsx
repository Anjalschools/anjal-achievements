"use client";

import { memo, useCallback, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import type { AdminDashboardPayload } from "@/lib/admin-dashboard-stats";
import {
  levelKeyLabel,
  statusBucketColor,
  statusBucketLabel,
} from "@/lib/admin-dashboard-ui-labels";

type Props = {
  data: AdminDashboardPayload;
  isAr: boolean;
};

const eventRowsForChart = (
  rows: AdminDashboardPayload["byEventStudents"],
  limit = 8
): Array<{ key: string; count: number; labelAr: string; labelEn: string }> => {
  const top = rows.slice(0, limit).map((r) => ({
    key: r.eventKey,
    count: r.studentCount,
    labelAr: r.labelAr,
    labelEn: r.labelEn,
  }));
  const rest = rows.slice(limit);
  if (!rest.length) return top;
  const sum = rest.reduce((acc, r) => acc + r.studentCount, 0);
  return [
    ...top,
    {
      key: "__other__",
      count: sum,
      labelAr: "أخرى",
      labelEn: "Other",
    },
  ];
};

const BAR_W = 640;
const BAR_H = 200;
const PAD = { t: 20, r: 20, b: 44, l: 46 };

const AcademicYearBarChart = memo(({ data, isAr }: Props) => {
  const rows = data.byAcademicYear;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { bars, max, innerH, baselineY } = useMemo(() => {
    const m = Math.max(1, ...rows.map((r) => r.count));
    const innerW = BAR_W - PAD.l - PAD.r;
    const innerH = BAR_H - PAD.t - PAD.b;
    const baselineY = PAD.t + innerH;
    const n = Math.max(1, rows.length);
    const gap = 10;
    const bw = Math.max(14, (innerW - gap * (n - 1)) / n);
    const bars = rows.map((r, i) => {
      const h = (r.count / m) * innerH;
      const x = PAD.l + i * (bw + gap);
      const y = baselineY - h;
      return { ...r, x, y, w: bw, h, i };
    });
    return { bars, max: m, innerH, baselineY };
  }, [rows]);

  const hideTip = useCallback(() => setTip(null), []);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(Math.round((max * i) / 4));
    return [...new Set(ticks)].sort((a, b) => a - b);
  }, [max]);

  const setTipFromEvent = useCallback(
    (e: MouseEvent, b: (typeof bars)[number]) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const lines = [
        `${b.key}: ${b.count}`,
        b.pctChangeFromPrevious != null
          ? `${isAr ? "التغير عن العام السابق" : "Change vs previous"}: ${
              b.pctChangeFromPrevious > 0 ? "+" : ""
            }${b.pctChangeFromPrevious}%`
          : null,
        b.isPeak ? (isAr ? "أعلى عام" : "Peak year") : null,
      ].filter(Boolean);
      setTip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        text: lines.join("\n"),
      });
    },
    [isAr]
  );

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-light">
        {isAr ? "لا توجد بيانات أعوام دراسية بعد." : "No academic year data yet."}
      </p>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-x-auto"
      onMouseLeave={hideTip}
    >
      <svg
        viewBox={`0 0 ${BAR_W} ${BAR_H}`}
        className="h-[200px] w-full min-w-[320px] max-w-full"
        role="img"
        aria-label={isAr ? "الإنجازات حسب العام الدراسي" : "Achievements by academic year"}
      >
        <defs>
          <linearGradient id="barPeak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#5b21b6" />
          </linearGradient>
          <linearGradient id="barNorm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {/* Y-axis labels + horizontal grid */}
        {yTicks.map((tick) => {
          if (tick === 0) return null;
          const ratio = max > 0 ? tick / max : 0;
          const gy = PAD.t + innerH * (1 - ratio);
          return (
            <g key={`g-${tick}`}>
              <line
                x1={PAD.l}
                y1={gy}
                x2={BAR_W - PAD.r}
                y2={gy}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={PAD.l - 6}
                y={gy + 4}
                textAnchor="end"
                className="fill-text-muted"
                style={{ fontSize: 10 }}
              >
                {tick}
              </text>
            </g>
          );
        })}
        <text
          x={PAD.l - 6}
          y={baselineY + 4}
          textAnchor="end"
          className="fill-text-muted"
          style={{ fontSize: 10 }}
        >
          0
        </text>

        {/* X baseline */}
        <line
          x1={PAD.l}
          y1={baselineY}
          x2={BAR_W - PAD.r}
          y2={baselineY}
          stroke="#94a3b8"
          strokeWidth={1.5}
        />

        {bars.map((b) => (
          <g key={b.key}>
            <title>
              {b.key}: {b.count}
              {b.pctChangeFromPrevious != null
                ? ` (${b.pctChangeFromPrevious > 0 ? "+" : ""}${b.pctChangeFromPrevious}% ${
                    isAr ? "عن السابق" : "vs prev"
                  })`
                : ""}
            </title>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={Math.max(b.h, 2)}
              rx={5}
              fill={b.isPeak ? "url(#barPeak)" : "url(#barNorm)"}
              className="cursor-pointer transition-opacity hover:opacity-90"
              onMouseEnter={(e) => setTipFromEvent(e, b)}
              onMouseMove={(e) => setTipFromEvent(e, b)}
            />
            <text
              x={b.x + b.w / 2}
              y={b.y - 6}
              textAnchor="middle"
              className="fill-text font-bold"
              style={{ fontSize: 11 }}
            >
              {b.count}
            </text>
            <text
              x={b.x + b.w / 2}
              y={baselineY + 18}
              textAnchor="middle"
              className="fill-text font-semibold"
              style={{ fontSize: 10 }}
            >
              {b.key}
            </text>
          </g>
        ))}
      </svg>
      {tip ? (
        <div
          className="pointer-events-none absolute z-10 max-w-[220px] whitespace-pre-line rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-text shadow-lg"
          style={{
            left: tip.x,
            top: tip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  );
});
AcademicYearBarChart.displayName = "AcademicYearBarChart";

const R = 52;
const CIRC = 2 * Math.PI * R;

const StatusDonutChart = memo(({ data, isAr }: Props) => {
  const segments = useMemo(() => {
    const list = data.byStatus.filter((s) => s.count > 0);
    const total = list.reduce((a, s) => a + s.count, 0) || 1;
    let cum = 0;
    return list.map((s) => {
      const frac = s.count / total;
      const len = frac * CIRC;
      const strokeDashoffset = -cum;
      cum += len;
      return {
        ...s,
        len,
        frac,
        strokeDashoffset,
        color: statusBucketColor(s.key),
      };
    });
  }, [data.byStatus]);

  if (segments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-light">
        {isAr ? "لا توجد بيانات للحالات." : "No status data."}
      </p>
    );
  }

  const total = segments.reduce((a, s) => a + s.count, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
      <svg width={160} height={160} viewBox="0 0 120 120" className="shrink-0" role="img">
        <g transform="translate(60,60) rotate(-90)">
          {segments.map((s) => (
            <circle
              key={s.key}
              r={R}
              cx={0}
              cy={0}
              fill="none"
              stroke={s.color}
              strokeWidth={18}
              strokeDasharray={`${s.len} ${CIRC}`}
              strokeDashoffset={s.strokeDashoffset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <g transform="translate(60,60)">
          <text
            textAnchor="middle"
            y={4}
            className="fill-text text-sm font-bold"
            style={{ fontSize: 14 }}
          >
            {total}
          </text>
          <text
            textAnchor="middle"
            y={18}
            className="fill-text-light text-[9px]"
            style={{ fontSize: 9 }}
          >
            {isAr ? "إجمالي" : "Total"}
          </text>
        </g>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate font-medium text-text">{statusBucketLabel(s.key, isAr)}</span>
            </span>
            <span className="shrink-0 font-bold text-text">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
StatusDonutChart.displayName = "StatusDonutChart";

const HorizontalBarGroup = memo(
  ({
    title,
    rows,
    labelFn,
    isAr,
    emptyText,
  }: {
    title: string;
    rows: { key: string; count: number }[];
    labelFn: (key: string, ar: boolean) => string;
    isAr: boolean;
    emptyText: string;
  }) => {
    const max = Math.max(1, ...rows.map((r) => r.count));
    const filtered = rows.filter((r) => r.count > 0);
    if (filtered.length === 0) {
      return <p className="py-6 text-center text-sm text-text-light">{emptyText}</p>;
    }
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-text-muted">{title}</p>
        <ul className="space-y-2.5">
          {filtered.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex justify-between gap-2 text-xs font-medium text-text">
                <span className="truncate">{labelFn(r.key, isAr)}</span>
                <span className="shrink-0 text-text-light">{r.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-primary/80 transition-all"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
);
HorizontalBarGroup.displayName = "HorizontalBarGroup";

const AdminDashboardCharts = memo(({ data, isAr }: Props) => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6 lg:col-span-2">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-text">
              {isAr ? "الإنجازات حسب العام الدراسي" : "Achievements by academic year"}
            </h3>
            <p className="mt-1 text-xs text-text-light">
              {isAr
                ? "عدد الإنجازات المضافة في كل عام دراسي مع مقارنة الأعوام الدراسية (آب–تموز)."
                : "Count of achievements per academic year (Aug–Jul), with year-over-year change."}
            </p>
          </div>
          <Link
            href="/admin/achievements/reports"
            className="text-xs font-semibold text-primary hover:underline"
          >
            {isAr ? "التقارير" : "Reports"}
          </Link>
        </div>
        <AcademicYearBarChart data={data} isAr={isAr} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <h3 className="mb-4 text-base font-bold text-text">
          {isAr ? "توزيع حالات الإنجازات" : "Achievement status distribution"}
        </h3>
        <StatusDonutChart data={data} isAr={isAr} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <h3 className="mb-4 text-base font-bold text-text">
          {isAr ? "الإنجازات حسب الجهة" : "Achievements by scope"}
        </h3>
        <HorizontalBarGroup
          title={isAr ? "المستوى التنظيمي للإنجاز" : "Achievement level"}
          rows={data.byLevel}
          labelFn={levelKeyLabel}
          isAr={isAr}
          emptyText={isAr ? "لا توجد بيانات." : "No data."}
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6 lg:col-span-2">
        <h3 className="mb-4 text-base font-bold text-text">
          {isAr ? "الإنجازات حسب المجال" : "Achievements by domain"}
        </h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <HorizontalBarGroup
            title={isAr ? "المجال المستنتج" : "Inferred field"}
            rows={data.byDomain}
            labelFn={(key, ar) => {
              const row = data.byDomain.find((r) => r.key === key);
              if (!row) return key;
              return ar ? row.labelAr : row.labelEn;
            }}
            isAr={isAr}
            emptyText={isAr ? "لا توجد بيانات." : "No data."}
          />
          <p className="self-center text-xs leading-relaxed text-text-light">
            {isAr
              ? "يستند التوزيع إلى «المجال المستنتج» الفعلي لكل إنجاز كما يظهر في المراجعة، مع تجميع القيم الفارغة ضمن «غير محدد»."
              : "Distribution is based on each achievement’s actual inferred field shown in review; only missing values are grouped as “Not specified”."}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6 lg:col-span-2">
        <h3 className="mb-4 text-base font-bold text-text">
          {isAr ? "عدد الطلاب حسب المسابقة" : "Students by competition"}
        </h3>
        <HorizontalBarGroup
          title={isAr ? "الطلاب الفريدون لكل مسابقة (أعلى النتائج)" : "Unique students per competition (top results)"}
          rows={eventRowsForChart(data.byEventStudents, 8)}
          labelFn={(key, ar) => {
            const row = data.byEventStudents.find((r) => r.eventKey === key);
            if (!row) return ar ? "أخرى" : "Other";
            return ar ? row.labelAr : row.labelEn;
          }}
          isAr={isAr}
          emptyText={isAr ? "لا توجد بيانات مسابقات." : "No competition data."}
        />
      </section>
    </div>
  );
});

AdminDashboardCharts.displayName = "AdminDashboardCharts";

export default AdminDashboardCharts;
