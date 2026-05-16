/**
 * Deterministic, rule-based competition intelligence (no LLM).
 * Populates focused report `decisionPlatform` payload.
 */

import type { FocusedExecutiveBundle, FocusedYearTrendRow } from "@/types/focused-activity-report";

export type PeerActivityMetricRow = {
  typeKey: string;
  rawKey: string;
  labelAr: string;
  labelEn: string;
  records: number;
  distinctStudents: number;
  gold: number;
  silver: number;
  bronze: number;
  totalMedals: number;
  nomination: number;
  participation: number;
  approved: number;
  excellenceRatePct: number;
  intlSharePct: number;
  participationOnlyRatio: number;
};

export type DecisionAlertKind = "success" | "risk" | "watch" | "momentum" | "segment";

export type DecisionAlert = {
  kind: DecisionAlertKind;
  icon: string;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
};

export type DecisionRecommendation = {
  priority: number;
  textAr: string;
  textEn: string;
};

export type MedalIntelligencePayload = {
  medalsPer100Records: number;
  goldPer100Records: number;
  nominationsPer100Records: number;
  participationOnlyRatio: number;
  heatLabelAr: string;
  heatLabelEn: string;
  heatScore: number;
  bars: { key: string; labelAr: string; labelEn: string; rate: number; heat: number }[];
};

export type BenchmarkIntelligencePayload = {
  sectionWinner: "arabic" | "international" | "tie";
  genderWinner: "male" | "female" | "tie";
  stageWinner: { stageKey: string; labelAr: string; labelEn: string } | null;
  mawhibaWinner: "mawhiba" | "non" | "tie";
  sectionGapPctPoints: number;
  genderGapPctPoints: number;
  mawhibaGapPctPoints: number;
  rows: Array<{
    dimensionAr: string;
    dimensionEn: string;
    leftLabelAr: string;
    leftLabelEn: string;
    rightLabelAr: string;
    rightLabelEn: string;
    leftPct: number;
    rightPct: number;
    winner: "left" | "right" | "tie";
  }>;
};

export type ActivityRankingPayload = {
  topByExcellence: PeerActivityMetricRow[];
  topByMedalDensity: PeerActivityMetricRow[];
  highParticipationLowMedal: PeerActivityMetricRow[];
  topInternationalShare: PeerActivityMetricRow[];
  current: {
    rankExcellence: number | null;
    rankMedalDensity: number | null;
    rankRecords: number | null;
    peerCount: number;
  };
};

export type CompetitionDecisionPlatform = {
  narrativeAr: string;
  narrativeEn: string;
  alerts: DecisionAlert[];
  recommendations: DecisionRecommendation[];
  medalIntelligence: MedalIntelligencePayload;
  benchmarkIntelligence: BenchmarkIntelligencePayload;
  activityRanking: ActivityRankingPayload;
};

const heatFromRate = (rate: number): number => {
  if (rate >= 25) return 100;
  if (rate >= 15) return 70;
  if (rate >= 8) return 45;
  if (rate >= 3) return 25;
  return 10;
};

export const buildMedalIntelligenceFromCounts = (input: {
  records: number;
  gold: number;
  silver: number;
  bronze: number;
  nomination: number;
  participation: number;
}): MedalIntelligencePayload => {
  const { records, gold, silver, bronze, nomination, participation } = input;
  const totalMedals = gold + silver + bronze;
  const medalsPer100Records = records > 0 ? Math.round((totalMedals / records) * 1000) / 10 : 0;
  const goldPer100Records = records > 0 ? Math.round((gold / records) * 1000) / 10 : 0;
  const nominationsPer100Records = records > 0 ? Math.round((nomination / records) * 1000) / 10 : 0;
  const participationOnlyRatio = records > 0 ? Math.round((participation / records) * 1000) / 10 : 0;
  const heatScore = heatFromRate(medalsPer100Records);
  let heatLabelAr = "ضغط أداء منخفض للميداليات";
  let heatLabelEn = "Low medal yield versus volume";
  if (heatScore >= 70) {
    heatLabelAr = "عائد ميداليات قوي";
    heatLabelEn = "Strong medal yield";
  } else if (heatScore >= 45) {
    heatLabelAr = "عائد ميداليات متوسط";
    heatLabelEn = "Moderate medal yield";
  }
  const bars = [
    {
      key: "medalsPer100",
      labelAr: "ميداليات / 100 سجل",
      labelEn: "Medals / 100 records",
      rate: medalsPer100Records,
      heat: heatFromRate(medalsPer100Records),
    },
    {
      key: "goldPer100",
      labelAr: "ذهبية / 100 سجل",
      labelEn: "Gold / 100 records",
      rate: goldPer100Records,
      heat: heatFromRate(goldPer100Records * 2.5),
    },
    {
      key: "nomPer100",
      labelAr: "ترشيحات / 100 سجل",
      labelEn: "Nominations / 100 records",
      rate: nominationsPer100Records,
      heat: heatFromRate(nominationsPer100Records * 3),
    },
  ];
  return {
    medalsPer100Records,
    goldPer100Records,
    nominationsPer100Records,
    participationOnlyRatio,
    heatLabelAr,
    heatLabelEn,
    heatScore,
    bars,
  };
};

export const buildBenchmarkIntelligence = (
  executive: FocusedExecutiveBundle
): BenchmarkIntelligencePayload => {
  const sec = executive.demographicStacks.sectionGender;
  const ar = sec.find((s) => s.key === "arabic");
  const intl = sec.find((s) => s.key === "international");
  const arTotal = (ar?.male ?? 0) + (ar?.female ?? 0);
  const intlTotal = (intl?.male ?? 0) + (intl?.female ?? 0);
  const arShare = arTotal + intlTotal > 0 ? (arTotal / (arTotal + intlTotal)) * 100 : 50;
  const intlShare = 100 - arShare;
  let sectionWinner: BenchmarkIntelligencePayload["sectionWinner"] = "tie";
  if (intlShare - arShare > 8) sectionWinner = "international";
  else if (arShare - intlShare > 8) sectionWinner = "arabic";

  const mCount = (ar?.male ?? 0) + (intl?.male ?? 0);
  const fCount = (ar?.female ?? 0) + (intl?.female ?? 0);
  const denom = mCount + fCount;
  const maleSharePct = denom > 0 ? (mCount / denom) * 100 : 50;
  const femaleSharePct = denom > 0 ? (fCount / denom) * 100 : 50;
  let genderWinner: BenchmarkIntelligencePayload["genderWinner"] = "tie";
  if (maleSharePct - femaleSharePct > 8) genderWinner = "male";
  else if (femaleSharePct - maleSharePct > 8) genderWinner = "female";

  const mh = executive.demographicStacks.mawhibaGender.find((x) => x.key === "mawhiba");
  const nm = executive.demographicStacks.mawhibaGender.find((x) => x.key === "non");
  const mhT = (mh?.male ?? 0) + (mh?.female ?? 0);
  const nmT = (nm?.male ?? 0) + (nm?.female ?? 0);
  const mhDenom = mhT + nmT;
  const mhShare = mhDenom > 0 ? (mhT / mhDenom) * 100 : 50;
  const nmShare = 100 - mhShare;
  let mawhibaWinner: BenchmarkIntelligencePayload["mawhibaWinner"] = "tie";
  if (mhShare - nmShare > 10) mawhibaWinner = "mawhiba";
  else if (nmShare - mhShare > 10) mawhibaWinner = "non";

  const stages = [...executive.demographicStacks.stageBreakdown].sort((a, b) => b.count - a.count);
  const stageWinner =
    stages.length && stages[0]!.count > 0
      ? {
          stageKey: stages[0]!.stageKey,
          labelAr: stages[0]!.labelAr,
          labelEn: stages[0]!.labelEn,
        }
      : null;

  const rows: BenchmarkIntelligencePayload["rows"] = [
    {
      dimensionAr: "القسم",
      dimensionEn: "Section",
      leftLabelAr: "عربي",
      leftLabelEn: "Arabic",
      rightLabelAr: "دولي",
      rightLabelEn: "International",
      leftPct: Math.round(arShare * 10) / 10,
      rightPct: Math.round(intlShare * 10) / 10,
      winner:
        sectionWinner === "arabic" ? "left" : sectionWinner === "international" ? "right" : "tie",
    },
    {
      dimensionAr: "الجنس",
      dimensionEn: "Gender",
      leftLabelAr: "بنين",
      leftLabelEn: "Male",
      rightLabelAr: "بنات",
      rightLabelEn: "Female",
      leftPct: Math.round(maleSharePct * 10) / 10,
      rightPct: Math.round(femaleSharePct * 10) / 10,
      winner: genderWinner === "male" ? "left" : genderWinner === "female" ? "right" : "tie",
    },
    {
      dimensionAr: "موهبة",
      dimensionEn: "Mawhiba",
      leftLabelAr: "موهبة",
      leftLabelEn: "Mawhiba",
      rightLabelAr: "غير موهبة",
      rightLabelEn: "Non‑Mawhiba",
      leftPct: Math.round(mhShare * 10) / 10,
      rightPct: Math.round(nmShare * 10) / 10,
      winner: mawhibaWinner === "mawhiba" ? "left" : mawhibaWinner === "non" ? "right" : "tie",
    },
  ];

  return {
    sectionWinner,
    genderWinner,
    stageWinner,
    mawhibaWinner,
    sectionGapPctPoints: Math.round((intlShare - arShare) * 10) / 10,
    genderGapPctPoints: Math.round((maleSharePct - femaleSharePct) * 10) / 10,
    mawhibaGapPctPoints: Math.round((mhShare - nmShare) * 10) / 10,
    rows,
  };
};

const rankIndex = (sorted: PeerActivityMetricRow[], typeKey: string, rawKey: string): number | null => {
  const i = sorted.findIndex((r) => r.typeKey === typeKey && r.rawKey === rawKey);
  return i === -1 ? null : i + 1;
};

export const buildActivityRanking = (
  peers: PeerActivityMetricRow[],
  focusType: string,
  focusRaw: string
): ActivityRankingPayload => {
  const peerCount = peers.length;
  const minRecords = 5;
  const eligible = peers.filter((p) => p.records >= minRecords);
  const byExcel = [...eligible].sort((a, b) => b.excellenceRatePct - a.excellenceRatePct).slice(0, 8);
  const byDensity = [...eligible]
    .sort((a, b) => {
      const da = a.records > 0 ? a.totalMedals / a.records : 0;
      const db = b.records > 0 ? b.totalMedals / b.records : 0;
      return db - da;
    })
    .slice(0, 8);
  const lowMedal = [...eligible]
    .filter(
      (p) =>
        p.records >= 15 &&
        p.participationOnlyRatio > 55 &&
        p.totalMedals < Math.max(3, p.records * 0.08)
    )
    .sort((a, b) => b.participationOnlyRatio - a.participationOnlyRatio)
    .slice(0, 6);
  const byIntl = [...eligible].sort((a, b) => b.intlSharePct - a.intlSharePct).slice(0, 8);

  return {
    topByExcellence: byExcel,
    topByMedalDensity: byDensity,
    highParticipationLowMedal: lowMedal,
    topInternationalShare: byIntl,
    current: {
      rankExcellence: rankIndex(byExcel, focusType, focusRaw),
      rankMedalDensity: rankIndex(byDensity, focusType, focusRaw),
      rankRecords: rankIndex([...peers].sort((a, b) => b.records - a.records), focusType, focusRaw),
      peerCount,
    },
  };
};

const pctChange = (curr: number, prev: number | null | undefined): number | null => {
  if (prev == null || prev === undefined || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};

const intlShareFromBenchmark = (b: BenchmarkIntelligencePayload): number => {
  const row = b.rows.find((r) => r.dimensionEn === "Section");
  return row?.rightPct ?? 0;
};

/** Rule-based executive narrative (Arabic + English). */
export const generateCompetitionExecutiveNarrative = (input: {
  activityLabelAr: string;
  activityLabelEn: string;
  totalRecords: number;
  distinctStudents: number;
  gold: number;
  totalMedals: number;
  excellenceRatePct: number;
  yCurr: FocusedYearTrendRow | null;
  yPrev: FocusedYearTrendRow | null;
  benchmark: BenchmarkIntelligencePayload;
  topStageLabelAr: string;
  topStageLabelEn: string;
}): { narrativeAr: string; narrativeEn: string } => {
  const {
    activityLabelAr,
    activityLabelEn,
    totalRecords,
    distinctStudents,
    gold,
    totalMedals,
    excellenceRatePct,
    yCurr,
    yPrev,
    benchmark,
    topStageLabelAr,
    topStageLabelEn,
  } = input;

  const partsAr: string[] = [];
  const partsEn: string[] = [];

  const yearPhraseAr = yCurr ? ` عام ${yCurr.year}` : "";
  const yearPhraseEn = yCurr ? ` in ${yCurr.year}` : "";

  const stYoY = pctChange(yCurr?.distinctStudents ?? 0, yPrev?.distinctStudents);
  if (stYoY != null && Math.abs(stYoY) >= 3 && yPrev && yCurr) {
    partsAr.push(
      stYoY >= 0
        ? `شهدت ${activityLabelAr}${yearPhraseAr} ارتفاعًا بنسبة ${stYoY}٪ في عدد المشاركين مقارنة بعام ${yPrev.year}`
        : `سجّلت ${activityLabelAr}${yearPhraseAr} انخفاضًا بنسبة ${Math.abs(stYoY)}٪ في عدد المشاركين مقارنة بعام ${yPrev.year}`
    );
    partsEn.push(
      stYoY >= 0
        ? `${activityLabelEn}${yearPhraseEn} posted a ${stYoY}% increase in distinct participants versus ${yPrev.year}`
        : `${activityLabelEn}${yearPhraseEn} recorded a ${Math.abs(stYoY)}% decrease in distinct participants versus ${yPrev.year}`
    );
  }

  if (totalMedals > 0 && totalRecords > 0) {
    partsAr.push(
      `مع تحقيق ${gold} ميدالية ذهبية وإجمالي ${totalMedals} ميدالية ضمن ${totalRecords} سجلًا`
    );
    partsEn.push(
      `with ${gold} gold medals and ${totalMedals} total medals across ${totalRecords} records`
    );
  }

  if (benchmark.genderWinner === "male" && benchmark.genderGapPctPoints > 5) {
    partsAr.push(`تفوّق واضح لمجموعة البنين في الحصّة النسبية للمشاركة`);
    partsEn.push(`male learners carry a higher participation share in this scope`);
  } else if (benchmark.genderWinner === "female" && benchmark.genderGapPctPoints < -5) {
    partsAr.push(`تفوّق واضح لمجموعة البنات في الحصّة النسبية للمشاركة`);
    partsEn.push(`female learners carry a higher participation share in this scope`);
  }

  if (benchmark.sectionWinner === "international" && benchmark.sectionGapPctPoints > 8) {
    partsAr.push(`وزن أعلى للقسم الدولي (${Math.round(intlShareFromBenchmark(benchmark))}٪ تقريبًا من سجلات الأقسام المقارنة)`);
    partsEn.push(`international section weight is elevated versus Arabic section in this activity`);
  } else if (benchmark.sectionWinner === "arabic" && benchmark.sectionGapPctPoints < -8) {
    partsAr.push(`القسم العربي يمثّل الحصّة الأكبر من السجلات المقارنة`);
    partsEn.push(`the Arabic section represents the larger share of comparable records`);
  }

  if (topStageLabelAr && topStageLabelEn && distinctStudents > 0) {
    partsAr.push(`أعلى كثافة مشاركة حسب المرحلة الظاهرة: ${topStageLabelAr}`);
    partsEn.push(`highest visible stage concentration: ${topStageLabelEn}`);
  }

  partsAr.push(`نسبة الاعتماد المعروضة ${excellenceRatePct}٪ ضمن النطاق الحالي`);
  partsEn.push(`displayed approval rate is ${excellenceRatePct}% under current filters`);

  if (partsAr.length === 0) {
    return {
      narrativeAr: `لا يتوفر اجتماع كافٍ للإشارات السنوية لـ ${activityLabelAr} ضمن الفلاتر؛ راجع حجم العينة أو توسيع النطاق.`,
      narrativeEn: `Insufficient convergent signals to extend the narrative for ${activityLabelEn}; widen filters or verify sample size.`,
    };
  }

  return {
    narrativeAr: partsAr.join("، ") + ".",
    narrativeEn: partsEn.join("; ") + ".",
  };
};

export const generateDecisionAlerts = (input: {
  activityLabelAr: string;
  activityLabelEn: string;
  executive: FocusedExecutiveBundle;
  medalIntel: MedalIntelligencePayload;
  yCurr: FocusedYearTrendRow | null;
  yPrev: FocusedYearTrendRow | null;
  benchmark: BenchmarkIntelligencePayload;
}): DecisionAlert[] => {
  const alerts: DecisionAlert[] = [];
  const { yCurr, yPrev, medalIntel, benchmark, executive } = input;
  const totalRecordsNum = Number(executive.kpiCards.find((c) => c.id === "records")?.value ?? 0);

  if (yCurr && yPrev) {
    const dropEx = yPrev.excellenceRatePct - yCurr.excellenceRatePct;
    if (dropEx >= 10) {
      alerts.push({
        kind: "risk",
        icon: "🔴",
        titleAr: "ضغط على جودة الاعتماد",
        titleEn: "Approval-rate pressure",
        detailAr: `انخفضت نسبة الاعتماد المعروضة بين ${yPrev.year} و${yCurr.year} بمقدار ${Math.round(dropEx * 10) / 10} نقطة مئوية.`,
        detailEn: `Displayed approval rate fell by ${Math.round(dropEx * 10) / 10} percentage points between ${yPrev.year} and ${yCurr.year}.`,
      });
    }
    if (yCurr.distinctStudents < yPrev.distinctStudents * 0.85 && yPrev.distinctStudents >= 8) {
      alerts.push({
        kind: "risk",
        icon: "🔴",
        titleAr: "تراجع حاد في المشاركين",
        titleEn: "Sharp dip in participants",
        detailAr: `عدد الطلاب في ${yCurr.year} أقل بوضوح عن ${yPrev.year} ضمن نفس النطاق.`,
        detailEn: `Distinct students in ${yCurr.year} are markedly below ${yPrev.year} under the same filters.`,
      });
    }
    if (yCurr.goldMedals > yPrev.goldMedals + 2 && yCurr.records >= 10) {
      alerts.push({
        kind: "success",
        icon: "🟢",
        titleAr: "زيادة في الميداليات الذهبية",
        titleEn: "Gold-medal momentum",
        detailAr: `تحسّن عدد الذهبيات بين العامين ${yPrev.year} و${yCurr.year}.`,
        detailEn: `Gold medal count improved between ${yPrev.year} and ${yCurr.year}.`,
      });
    }
    if (yCurr.distinctStudents > yPrev.distinctStudents * 1.12 && yPrev.distinctStudents >= 5) {
      alerts.push({
        kind: "momentum",
        icon: "🔵",
        titleAr: "نمو واضح في المشاركة",
        titleEn: "Rising participation footprint",
        detailAr: `ارتفع عدد الطلاب المشاركين بين ${yPrev.year} و${yCurr.year}.`,
        detailEn: `Distinct student participation rose between ${yPrev.year} and ${yCurr.year}.`,
      });
    }
  }

  if (medalIntel.nominationsPer100Records < 2 && totalRecordsNum > 25) {
    alerts.push({
      kind: "watch",
      icon: "🟡",
      titleAr: "ترشيحات نادرة مقارنة بالحجم",
      titleEn: "Thin nomination rate versus volume",
      detailAr: `معدل الترشيحات لكل 100 سجل منخفض (${medalIntel.nominationsPer100Records}) رغم ارتفاع الحجم.`,
      detailEn: `Nominations per 100 records (${medalIntel.nominationsPer100Records}) remain low relative to volume.`,
    });
  }

  if (medalIntel.participationOnlyRatio > 45 && totalRecordsNum > 20) {
    alerts.push({
      kind: "watch",
      icon: "🟡",
      titleAr: "طابع «مشاركة فقط» بارز",
      titleEn: "Participation-only skew",
      detailAr: "نسبة كبيرة من السجلات مصنّفة كمشاركة فقط؛ راجع التقاط النتائج التنافسية.",
      detailEn: "A large share of records are participation-only; review competitive outcome capture.",
    });
  }

  if (benchmark.sectionWinner === "international" && benchmark.sectionGapPctPoints > 12) {
    alerts.push({
      kind: "segment",
      icon: "🟣",
      titleAr: "تفوّق نسبي للقسم الدولي",
      titleEn: "International section tilt",
      detailAr: "الوزن النسبي للقسم الدولي أعلى ضمن نطاق هذا النشاط.",
      detailEn: "International-section share is comparatively high for this activity scope.",
    });
  }

  if (benchmark.genderWinner === "male" && benchmark.genderGapPctPoints > 15) {
    alerts.push({
      kind: "segment",
      icon: "🟣",
      titleAr: "ترجيح مشاركة البنين",
      titleEn: "Male participation tilt",
      detailAr: `حصة البنين أعلى بنحو ${Math.round(Math.abs(benchmark.genderGapPctPoints) * 10) / 10} نقطة مئوية مقارنة بالتعادل.`,
      detailEn: `Male share exceeds female share by about ${Math.round(Math.abs(benchmark.genderGapPctPoints) * 10) / 10} percentage points.`,
    });
  }

  if (benchmark.mawhibaWinner === "mawhiba" && benchmark.mawhibaGapPctPoints > 12) {
    alerts.push({
      kind: "success",
      icon: "🟢",
      titleAr: "حضور قوي لموهبة",
      titleEn: "Strong Mawhiba presence",
      detailAr: "موهبة تمثّل حصة متقدّمة ضمن هذا النطاق.",
      detailEn: "Mawhiba learners represent a leading share in this filter scope.",
    });
  }

  return alerts.slice(0, 8);
};

export const buildRuleBasedRecommendations = (input: {
  alerts: DecisionAlert[];
  medalIntel: MedalIntelligencePayload;
  benchmark: BenchmarkIntelligencePayload;
  stageBreakdown: FocusedExecutiveBundle["demographicStacks"]["stageBreakdown"];
}): DecisionRecommendation[] => {
  const recs: DecisionRecommendation[] = [];
  const stages = [...input.stageBreakdown].sort((a, b) => a.count - b.count);
  const weakest = stages[0];

  if (input.alerts.some((a) => a.kind === "watch" && a.titleEn.includes("nomination"))) {
    recs.push({
      priority: 1,
      textAr: "تصعيد إجراءات ما قبل الترشيح (معايير وورش تحضير) لرفع معدل الترشيحات المعتمدة.",
      textEn: "Elevate pre-nomination readiness (criteria + short intensives) to lift verified nomination throughput.",
    });
  }
  if (input.medalIntel.heatScore < 40 && input.medalIntel.participationOnlyRatio > 35) {
    recs.push({
      priority: 2,
      textAr: "ربط المشاركة بمسارات نتائج قابلة للتحقق (اختبارات/مسابقات داخلية) لتقليل الانحراف نحو «مشاركة فقط».",
      textEn: "Tie participation tracks to verifiable competitive outcomes to reduce participation-only drift.",
    });
  }
  if (input.benchmark.sectionWinner === "international" && input.benchmark.sectionGapPctPoints > 15) {
    recs.push({
      priority: 3,
      textAr: "مواءمة دعم القسم العربي ببرامج موازية تضمن تكافؤ الفرص مع المسار الدولي.",
      textEn: "Balance Arabic-section support with parallel scaffolding so opportunity access matches the international track.",
    });
  }
  if (weakest && weakest.count > 0 && stages.length > 1) {
    recs.push({
      priority: 4,
      textAr: `تخصيص حزمة تدخل للمرحلة ${weakest.labelAr} حيث تبدو الكثافة الأضعف ضمن النطاق.`,
      textEn: `Target a scoped intervention package for ${weakest.labelEn}, which shows the lightest concentration in-filter.`,
    });
  }
  if (recs.length === 0) {
    recs.push({
      priority: 5,
      textAr: "استمرار مراقبة مؤشرات العام الحالي وتوحيد التقارير الدورية للجان الاعتماد.",
      textEn: "Sustain monitoring of current-year indicators and standardise cyclical briefings for approval committees.",
    });
  }
  return recs.slice(0, 6);
};

export const buildCompetitionDecisionPlatform = (input: {
  activityLabelAr: string;
  activityLabelEn: string;
  focusType: string;
  focusRaw: string;
  totalRecords: number;
  distinctStudents: number;
  approvedRecords: number;
  excellenceRatePct: number;
  gold: number;
  silver: number;
  bronze: number;
  nomination: number;
  participation: number;
  executive: FocusedExecutiveBundle;
  yCurr: FocusedYearTrendRow | null;
  yPrev: FocusedYearTrendRow | null;
  peerRows: PeerActivityMetricRow[];
}): CompetitionDecisionPlatform => {
  const totalMedals = input.gold + input.silver + input.bronze;
  const medalIntel = buildMedalIntelligenceFromCounts({
    records: input.totalRecords,
    gold: input.gold,
    silver: input.silver,
    bronze: input.bronze,
    nomination: input.nomination,
    participation: input.participation,
  });
  const benchmarkIntelligence = buildBenchmarkIntelligence(input.executive);
  const activityRanking = buildActivityRanking(input.peerRows, input.focusType, input.focusRaw);
  const topStage = input.executive.demographicStacks.stageBreakdown.slice().sort((a, b) => b.count - a.count)[0];

  const { narrativeAr, narrativeEn } = generateCompetitionExecutiveNarrative({
    activityLabelAr: input.activityLabelAr,
    activityLabelEn: input.activityLabelEn,
    totalRecords: input.totalRecords,
    distinctStudents: input.distinctStudents,
    gold: input.gold,
    totalMedals,
    excellenceRatePct: input.excellenceRatePct,
    yCurr: input.yCurr,
    yPrev: input.yPrev,
    benchmark: benchmarkIntelligence,
    topStageLabelAr: topStage?.labelAr ?? "",
    topStageLabelEn: topStage?.labelEn ?? "",
  });

  const alerts = generateDecisionAlerts({
    activityLabelAr: input.activityLabelAr,
    activityLabelEn: input.activityLabelEn,
    executive: input.executive,
    medalIntel,
    yCurr: input.yCurr,
    yPrev: input.yPrev,
    benchmark: benchmarkIntelligence,
  });

  const recommendations = buildRuleBasedRecommendations({
    alerts,
    medalIntel,
    benchmark: benchmarkIntelligence,
    stageBreakdown: input.executive.demographicStacks.stageBreakdown,
  });

  return {
    narrativeAr,
    narrativeEn,
    alerts,
    recommendations,
    medalIntelligence: medalIntel,
    benchmarkIntelligence,
    activityRanking,
  };
};
