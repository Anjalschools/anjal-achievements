"use client";

import React, { memo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { ANJAL_CHART } from "@/lib/anjal-chart-theme";
import { CI_ALERT_TONE } from "@/lib/competition-intelligence-theme";
import type { CompetitionDecisionPlatform } from "@/lib/competition-decision-intelligence";

const heatToColor = (heat: number) => {
  if (heat >= 70) return ANJAL_CHART.successGreen;
  if (heat >= 45) return ANJAL_CHART.gold;
  if (heat >= 25) return ANJAL_CHART.nominationViolet;
  return ANJAL_CHART.alertRed;
};

const alertToneClass = (kind: string) => {
  if (kind === "risk") return CI_ALERT_TONE.risk;
  if (kind === "success") return CI_ALERT_TONE.success;
  if (kind === "momentum") return CI_ALERT_TONE.momentum;
  if (kind === "segment") return CI_ALERT_TONE.segment;
  return CI_ALERT_TONE.watch;
};

export const CompetitionDecisionSections = memo(
  ({
    isAr,
    dp,
    activityLabel,
    hideNarrative = false,
  }: {
    isAr: boolean;
    dp: CompetitionDecisionPlatform;
    activityLabel: string;
    /** When true, skip the narrative block (e.g. shown in executive hero). */
    hideNarrative?: boolean;
  }) => {
    const medalData = dp.medalIntelligence.bars.map((b) => ({
      name: isAr ? b.labelAr : b.labelEn,
      rate: b.rate,
      heat: b.heat,
    }));

    return (
      <div className="space-y-4">
        {!hideNarrative ? (
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm print:break-inside-avoid">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
              {isAr ? "الملخص التنفيذي (قواعد)" : "Executive narrative (rule-based)"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-800" dir="auto">
              {isAr ? dp.narrativeAr : dp.narrativeEn}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
          <h3 className="text-sm font-black text-slate-900">{isAr ? "تنبيهات قرار" : "Decision alerts"}</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {dp.alerts.map((a, i) => (
              <li
                key={i}
                className={`rounded-xl border p-3 text-xs ${alertToneClass(a.kind)}`}
              >
                <span className="text-base" aria-hidden>
                  {a.icon}
                </span>{" "}
                <span className="font-bold text-slate-900">{isAr ? a.titleAr : a.titleEn}</span>
                <p className="mt-1 text-[11px] leading-snug text-slate-700">{isAr ? a.detailAr : a.detailEn}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-black text-slate-900">
            {isAr ? "توصيات قواعدية" : "Rule-based recommendations"}
          </h3>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-xs text-slate-800">
            {dp.recommendations.map((r, i) => (
              <li key={i} dir="auto">
                {isAr ? r.textAr : r.textEn}
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
            <h3 className="text-sm font-black text-slate-900">
              {isAr ? "محرك أداء الميداليات" : "Medal performance engine"}
            </h3>
            <p className="mt-1 text-[11px] text-slate-600">{isAr ? dp.medalIntelligence.heatLabelAr : dp.medalIntelligence.heatLabelEn}</p>
            <div className="mt-2 h-56 min-h-[220px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={medalData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals />
                  <Tooltip formatter={(v: number) => [v, isAr ? "معدل" : "Rate"]} />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]} name={isAr ? "معدل" : "Rate"}>
                    {medalData.map((e, i) => (
                      <Cell key={i} fill={heatToColor(e.heat)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
            <h3 className="text-sm font-black text-slate-900">
              {isAr ? "ذكاء المقارنة المرجعي" : "Benchmark intelligence"}
            </h3>
            <div className="mt-3 space-y-2 text-[11px]">
              {dp.benchmarkIntelligence.rows.map((row, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2">
                  <span className="font-bold text-slate-800">{isAr ? row.dimensionAr : row.dimensionEn}</span>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-lg px-2 py-0.5 font-semibold ${
                        row.winner === "left" ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200" : "bg-white text-slate-700"
                      }`}
                    >
                      {isAr ? row.leftLabelAr : row.leftLabelEn}: {row.leftPct}%
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 font-semibold ${
                        row.winner === "right" ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200" : "bg-white text-slate-700"
                      }`}
                    >
                      {isAr ? row.rightLabelAr : row.rightLabelEn}: {row.rightPct}%
                    </span>
                    {row.winner === "tie" ? (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">{isAr ? "تعادل" : "Tie"}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {dp.benchmarkIntelligence.stageWinner ? (
              <p className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/80 px-2 py-2 text-[11px] font-semibold text-indigo-950">
                🏅{" "}
                {isAr ? "أعلى مرحلة حسب الحجم: " : "Largest stage by volume: "}
                <span dir="auto">
                  {isAr
                    ? dp.benchmarkIntelligence.stageWinner.labelAr
                    : dp.benchmarkIntelligence.stageWinner.labelEn}
                </span>
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid">
          <h3 className="text-sm font-black text-slate-900">
            {isAr ? "ترتيب الأنشطة (نطاق الفلاتر)" : "Activity ranking (filter scope)"}{" "}
            <span className="text-xs font-normal text-slate-500">
              — {isAr ? "النشاط الحالي" : "Current"}: {activityLabel}
            </span>
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {isAr
              ? `مركز الاعتماد: ${dp.activityRanking.current.rankExcellence ?? "—"} · مركز كثافة الميداليات: ${dp.activityRanking.current.rankMedalDensity ?? "—"} · أقران: ${dp.activityRanking.current.peerCount}`
              : `Approval rank: ${dp.activityRanking.current.rankExcellence ?? "—"} · Medal-density rank: ${dp.activityRanking.current.rankMedalDensity ?? "—"} · Peers: ${dp.activityRanking.current.peerCount}`}
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase text-amber-800">🏆 {isAr ? "أعلى اعتماد" : "Top approval"}</p>
              <ul className="mt-1 space-y-1 text-[11px]">
                {dp.activityRanking.topByExcellence.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1" dir="auto">
                    <span className="truncate">{isAr ? r.labelAr : r.labelEn}</span>
                    <span className="shrink-0 tabular-nums font-bold">{r.excellenceRatePct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-red-700">⚠ {isAr ? "مشاركة عالية — ميداليات منخفضة" : "High volume — low medals"}</p>
              <ul className="mt-1 space-y-1 text-[11px]">
                {dp.activityRanking.highParticipationLowMedal.length === 0 ? (
                  <li className="text-slate-500">{isAr ? "لا توجد حالات بارزة." : "No prominent cases."}</li>
                ) : (
                  dp.activityRanking.highParticipationLowMedal.map((r, i) => (
                    <li key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1" dir="auto">
                      <span className="truncate">{isAr ? r.labelAr : r.labelEn}</span>
                      <span className="shrink-0 tabular-nums text-red-700">{r.participationOnlyRatio}% P</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      </div>
    );
  }
);
CompetitionDecisionSections.displayName = "CompetitionDecisionSections";
