/**
 * Talent discovery recommendation layer — rising cohorts & underused talent signals (client layer).
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

export type TalentSignalKind =
  | "conversion_lift"
  | "participation_diversity"
  | "rapid_growth"
  | "emerging_participation"
  | "sporadic_excellence";

export type TalentSignal = {
  id: string;
  kind: TalentSignalKind;
  labelAr: string;
  labelEn: string;
  metricValue: number;
  activityKey?: string;
  activityLabelAr?: string;
  activityLabelEn?: string;
  levelLabelAr?: string;
  levelLabelEn?: string;
};

export type TalentDiscoveryRecommendation = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
  confidence: number;
  activityKey?: string;
  levelLabelAr?: string;
  levelLabelEn?: string;
  sectionHint?: "arabic" | "international";
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export const buildTalentDiscoverySignals = (
  table: ParticipationActivityRow[]
): TalentSignal[] => {
  const signals: TalentSignal[] = [];

  for (const r of table) {
    if (r.totalParticipations < 5) continue;
    const medals = r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount;
    const conversion = pct(medals, r.totalParticipations);
    const density =
      r.distinctParticipants > 0 ? r.totalParticipations / r.distinctParticipants : 0;

    if (conversion >= 25 && r.distinctParticipants >= 8) {
      signals.push({
        id: `talent_conv_${r.activityKey}`,
        kind: "conversion_lift",
        labelAr: `تحويل مرتفع — ${r.activityLabelAr}`,
        labelEn: `High conversion — ${r.activityLabelEn}`,
        metricValue: conversion,
        activityKey: r.activityKey,
        activityLabelAr: r.activityLabelAr,
        activityLabelEn: r.activityLabelEn,
        levelLabelAr: r.levelLabelAr,
        levelLabelEn: r.levelLabelEn,
      });
    }

    if (density >= 1.8 && r.distinctParticipants >= 10) {
      signals.push({
        id: `talent_div_${r.activityKey}`,
        kind: "participation_diversity",
        labelAr: `تنوع مشاركة — ${r.activityLabelAr}`,
        labelEn: `Participation diversity — ${r.activityLabelEn}`,
        metricValue: density,
        activityKey: r.activityKey,
        activityLabelAr: r.activityLabelAr,
        activityLabelEn: r.activityLabelEn,
      });
    }

    if (
      r.excellenceRatePct >= 12 &&
      r.totalParticipations < table.reduce((m, x) => Math.max(m, x.totalParticipations), 0) * 0.5
    ) {
      signals.push({
        id: `talent_sporadic_${r.activityKey}`,
        kind: "sporadic_excellence",
        labelAr: `تفوق ناشئ — ${r.activityLabelAr}`,
        labelEn: `Emerging excellence — ${r.activityLabelEn}`,
        metricValue: r.excellenceRatePct,
        activityKey: r.activityKey,
        activityLabelAr: r.activityLabelAr,
        activityLabelEn: r.activityLabelEn,
      });
    }
  }

  const arabicStrong = table.filter(
    (r) => r.arabicParticipants > r.internationalParticipants * 2 && r.totalParticipations >= 10
  );
  if (arabicStrong.length > 0) {
    const best = arabicStrong.sort((a, b) => b.excellenceRatePct - a.excellenceRatePct)[0]!;
    signals.push({
      id: "talent_arabic_cohort",
      kind: "emerging_participation",
      labelAr: "نمو في القسم العربي",
      labelEn: "Growth in Arabic section",
      metricValue: best.excellenceRatePct,
      activityKey: best.activityKey,
      activityLabelAr: best.activityLabelAr,
      activityLabelEn: best.activityLabelEn,
    });
  }

  return signals.sort((a, b) => b.metricValue - a.metricValue).slice(0, 8);
};

export const buildTalentDiscoveryRecommendations = (
  table: ParticipationActivityRow[],
  signals: TalentSignal[]
): TalentDiscoveryRecommendation[] => {
  const recs: TalentDiscoveryRecommendation[] = [];
  const lowestLevel = [...table]
    .filter((r) => r.totalParticipations > 0)
    .reduce(
      (acc, r) => {
        if (!acc || r.totalParticipations < acc.totalParticipations) return r;
        return acc;
      },
      null as ParticipationActivityRow | null
    );

  if (lowestLevel) {
    const olympiad = table.find((r) =>
      /olympiad|أولمبياد|math|رياضيات/i.test(r.activityLabelEn + r.activityLabelAr)
    );
    if (olympiad) {
      recs.push({
        id: "talent_rec_olympiad_level",
        bodyAr: `يوصى بضم طلاب ${lowestLevel.levelLabelAr} إلى برامج ${olympiad.activityLabelAr}.`,
        bodyEn: `Recommend enrolling ${lowestLevel.levelLabelEn} students into ${olympiad.activityLabelEn}.`,
        priority: 78,
        confidence: 0.72,
        activityKey: olympiad.activityKey,
        levelLabelAr: lowestLevel.levelLabelAr,
        levelLabelEn: lowestLevel.levelLabelEn,
      });
    }
  }

  const coding = table.find((r) => /bebras|بيبراس|programming|برمجة|robot/i.test(r.activityLabelEn + r.activityLabelAr));
  const arHeavy = table.filter((r) => r.arabicParticipants >= r.internationalParticipants * 1.5);
  if (coding && arHeavy.length > 0) {
    recs.push({
      id: "talent_rec_arabic_coding",
      bodyAr: "هناك طلاب واعدون في القسم العربي ضمن مسابقات البرمجة والعلوم.",
      bodyEn: "Promising students in the Arabic section show potential in coding/science competitions.",
      priority: 74,
      confidence: 0.68,
      activityKey: coding.activityKey,
      sectionHint: "arabic",
    });
  }

  const femaleHeavy = table.filter((r) => r.femaleParticipants > r.maleParticipants * 1.2);
  const sci = femaleHeavy.find((r) =>
    /science|علم|olympiad|أولمبياد/i.test(r.activityLabelEn + r.activityLabelAr)
  );
  if (sci) {
    recs.push({
      id: "talent_rec_girls_sci",
      bodyAr: `طالبات ${sci.levelLabelAr} يظهرن نموًا سريعًا في الأنشطة العلمية.`,
      bodyEn: `Girls in ${sci.levelLabelEn} show rapid growth in science activities.`,
      priority: 70,
      confidence: 0.65,
      activityKey: sci.activityKey,
      levelLabelAr: sci.levelLabelAr,
      levelLabelEn: sci.levelLabelEn,
    });
  }

  for (const sig of signals.slice(0, 2)) {
    if (sig.kind === "conversion_lift" && sig.activityLabelAr) {
      recs.push({
        id: `talent_rec_sig_${sig.id}`,
        bodyAr: `فرصة لاكتشاف مواهب في ${sig.activityLabelAr} (تحويل ${sig.metricValue}%).`,
        bodyEn: `Talent discovery opportunity in ${sig.activityLabelEn} (${sig.metricValue}% conversion).`,
        priority: 66,
        confidence: 0.62,
        activityKey: sig.activityKey,
        levelLabelAr: sig.levelLabelAr,
        levelLabelEn: sig.levelLabelEn,
      });
    }
  }

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 6);
};
