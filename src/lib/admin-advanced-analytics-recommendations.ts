import type { AdminAnalyticsRecommendation, AdvancedLabeledRow } from "@/lib/admin-advanced-analytics-types";

/**
 * Rule-based, data-grounded recommendations (not generative AI).
 * Arabic + English for bilingual UI.
 */
export type RecommendationsInput = {
  scopeYear: number;
  yearTotal: number;
  approvedInYear: number;
  featuredInYear: number;
  featuredShareOfApprovedPct: number | null;
  approvedShareOfYearPct: number | null;
  typeRows: AdvancedLabeledRow[];
  fieldRows: AdvancedLabeledRow[];
  levelRows: AdvancedLabeledRow[];
  stageRows: AdvancedLabeledRow[];
  gradeRows: AdvancedLabeledRow[];
  arTrack: number;
  intlTrack: number;
  unspecifiedTrack: number;
  monthCounts: number[];
  monthLabelsAr: string[];
  statusPending: number;
  statusNeedsRevision: number;
  statusRejected: number;
  totalRecords: number;
};

const priorityOrder = (p: AdminAnalyticsRecommendation["priority"]) =>
  p === "high" ? 0 : p === "medium" ? 1 : 2;

const pushUnique = (list: AdminAnalyticsRecommendation[], item: AdminAnalyticsRecommendation) => {
  if (list.some((x) => x.id === item.id)) return;
  list.push(item);
};

export const buildAdvancedAnalyticsRecommendations = (input: RecommendationsInput): AdminAnalyticsRecommendation[] => {
  const {
    scopeYear,
    yearTotal,
    approvedInYear,
    featuredInYear,
    featuredShareOfApprovedPct,
    approvedShareOfYearPct,
    typeRows,
    fieldRows,
    levelRows,
    stageRows,
    gradeRows,
    arTrack,
    intlTrack,
    unspecifiedTrack,
    monthCounts,
    monthLabelsAr,
    statusPending,
    statusNeedsRevision,
    statusRejected,
    totalRecords,
  } = input;

  const out: AdminAnalyticsRecommendation[] = [];

  if (yearTotal < 1) {
    return [];
  }

  const monthSum = monthCounts.reduce((s, n) => s + n, 0);
  let maxMonthIdx = 0;
  let maxMonthVal = 0;
  monthCounts.forEach((n, i) => {
    if (n > maxMonthVal) {
      maxMonthVal = n;
      maxMonthIdx = i;
    }
  });
  const monthPeakShare = monthSum > 0 ? maxMonthVal / monthSum : 0;

  const topType = typeRows[0];
  const secondType = typeRows[1];

  // 1) Featured / approved pipeline
  if (approvedInYear >= 4 && featuredShareOfApprovedPct !== null && featuredShareOfApprovedPct < 20) {
    pushUnique(out, {
      id: "rec-featured-pipeline",
      titleAr: "رفع نسبة التمييز من الإنجازات المعتمدة",
      titleEn: "Raise featured share among approved achievements",
      descriptionAr: `نسبة الإنجازات المميزة من المعتمدة في نطاق العام (${scopeYear}) حوالي ${featuredShareOfApprovedPct}% فقط رغم وجود ${approvedInYear} إنجازًا معتمدًا — ما يشير إلى فرصة لتنشيط مسار ترشيح وتمييز قبل النشر المؤسسي.`,
      descriptionEn: `Featured share of approved items in scope year ${scopeYear} is about ${featuredShareOfApprovedPct}% with ${approvedInYear} approved records — room for a structured shortlist and featuring workflow.`,
      priority: featuredShareOfApprovedPct < 10 ? "high" : "medium",
      category: "strategy",
      relatedMetricKey: "featuredShareOfApprovedPct",
      nextStepAr:
        "عقد جلسة دورية لاختيار إنجازات معتمدة عالية المستوى للتمييز، مع معايير واضحة وربطها بروزنامة النشر المؤسسي.",
      nextStepEn:
        "Run a periodic shortlist of high-level approved items for featuring, with clear criteria tied to communications cadence.",
      relatedLabelsAr: [`نطاق العام: ${scopeYear}`, `معتمد في النطاق: ${approvedInYear}`],
    });
  }

  // 2) Type dominance (competitions vs programs diversity)
  if (topType && approvedInYear >= 6 && topType.pct >= 45) {
    const secondPct = secondType?.pct ?? 0;
    pushUnique(out, {
      id: "rec-type-diversity",
      titleAr: "توسيع تنوع المسابقات والبرامج المسجّلة",
      titleEn: "Broaden mix of competition and program entries",
      descriptionAr: `نوع «${topType.labelAr}» يمثل حوالي ${topType.pct}% من الإنجازات المعتمدة في نطاق العام، بينما ثاني الأنواع حوالي ${secondPct}% — يُنصح بتقليل الاعتماد على مسار واحد عبر دعم برامج إثرائية ومسارات بديلة.`,
      descriptionEn: `Type “${topType.labelEn}” is about ${topType.pct}% of approved in-scope achievements; the next type is ~${secondPct}% — reduce single-path dependence with enrichment programs and parallel tracks.`,
      priority: topType.pct >= 60 ? "high" : "medium",
      category: "diversity",
      relatedMetricKey: "achievementTypeBreakdown",
      nextStepAr:
        "تصميم حزمة فرص (أولمبياد، برامج تميز، معارض) موزّعة على الفصول مع مؤشرات مشاركة لكل نوع إدخال.",
      nextStepEn:
        "Design a term-spread bundle (olympiads, programs, exhibitions) with participation targets per entry type.",
      relatedLabelsAr: [topType.labelAr, secondType?.labelAr].filter(Boolean) as string[],
    });
  }

  // 3) Low-activity inferred fields (academic domains)
  const weakFields = fieldRows
    .filter((r) => r.key !== "—" && r.count >= 1 && r.pct <= 12 && r.count <= Math.max(3, Math.ceil(approvedInYear * 0.08)))
    .slice(0, 3);
  for (let i = 0; i < weakFields.length; i++) {
    const f = weakFields[i];
    const fieldIdSlug = String(f.key || "x")
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    pushUnique(out, {
      id: `rec-field-${fieldIdSlug}-${i}`,
      titleAr: `تعزيز المشاركة في مجال «${f.labelAr}»`,
      titleEn: `Boost participation in “${f.labelEn}”`,
      descriptionAr: `مجال «${f.labelAr}» يظهر بتمثيل منخفض (${f.count} إنجازًا معتمدًا في النطاق، حوالي ${f.pct}% من إجمالي المجالات المسجّلة) — ما يقلل تنوع القاعدة الترشيحية للمستويات الأعلى.`,
      descriptionEn: `Field “${f.labelEn}” is under-represented (${f.count} approved in scope, ~${f.pct}% of field mix) — narrowing the pipeline toward higher tiers.`,
      priority: f.pct <= 5 ? "medium" : "low",
      category: "program",
      relatedMetricKey: "inferredFieldBreakdown",
      nextStepAr:
        "ربط المجال بمسابقات أو برامج إعداد مبكرة داخل المدرسة، مع متابعة ربع سنوية لعدد الإدخالات المعتمدة.",
      nextStepEn:
        "Tie the field to early-prep competitions or in-school programs, with quarterly counts of approved entries.",
      relatedLabelsAr: [f.labelAr],
    });
  }

  // 4) Track imbalance
  const trackPairSum = arTrack + intlTrack;
  if (trackPairSum >= 6) {
    if (arTrack > intlTrack * 1.35 && intlTrack > 0) {
      pushUnique(out, {
        id: "rec-track-international-lift",
        titleAr: "دعم المسار الدولي لموازنة الإنجازات المعتمدة",
        titleEn: "Support the international track to rebalance approved volume",
        descriptionAr: `المسار العربي يضم ${arTrack} إنجازًا معتمدًا مقابل ${intlTrack} في الدولي ضمن نطاق العام — يُوصى بتوسيع فرص البرامج والمسابقات الدولية والإرشاد المسبق للطلاب.`,
        descriptionEn: `Arabic track shows ${arTrack} approved vs ${intlTrack} international in scope — expand international program slots and pre-guidance.`,
        priority: "medium",
        category: "pathway",
        relatedMetricKey: "trackComparison",
        nextStepAr:
          "تفعيل ورش توجيه للمسار الدولي، وربطها بشراكات أو مسابقات خارجية مع متابعة أعداد الاعتمادات.",
        nextStepEn:
          "Run orientation workshops for the international track and external competition partnerships with approval tracking.",
        relatedLabelsAr: ["المسار العربي", "المسار الدولي"],
      });
    } else if (intlTrack > arTrack * 1.35 && arTrack > 0) {
      pushUnique(out, {
        id: "rec-track-arabic-lift",
        titleAr: "تعزيز المسار العربي لتحقيق توازن مؤسسي",
        titleEn: "Strengthen the Arabic track for institutional balance",
        descriptionAr: `المسار الدولي يضم ${intlTrack} إنجازًا معتمدًا مقابل ${arTrack} في العربي — راجع التوازن بين المسارات ووسّع الفرص العربية إن كان الهدف تمثيلًا متكافئًا.`,
        descriptionEn: `International track has ${intlTrack} approved vs ${arTrack} Arabic — review balance and widen Arabic-track opportunities if equity is a goal.`,
        priority: "medium",
        category: "pathway",
        relatedMetricKey: "trackComparison",
        nextStepAr:
          "إضافة مسابقات وطنية/محلية موجهة للمسار العربي مع مؤشرات مشاركة فصلية.",
        nextStepEn:
          "Add national/local competitions aimed at the Arabic track with termly participation KPIs.",
        relatedLabelsAr: ["المسار العربي", "المسار الدولي"],
      });
    }
  }
  if (unspecifiedTrack >= 4 && trackPairSum + unspecifiedTrack >= 8) {
    pushUnique(out, {
      id: "rec-track-metadata",
      titleAr: "تصحيح بيانات القسم/المسار لغير المحدد",
      titleEn: "Fix section/track data for unspecified rows",
      descriptionAr: `يوجد ${unspecifiedTrack} إنجازًا معتمدًا ضمن «غير محدد» مسارًا — تحسين التعريف يقوي مقارنات المسارات والتوصيات اللاحقة.`,
      descriptionEn: `${unspecifiedTrack} approved items are “unspecified” on track — cleaner metadata improves pathway analytics.`,
      priority: "low",
      category: "quality",
      relatedMetricKey: "trackComparison",
      nextStepAr: "مراجعة سجلات الطلاب وربطها بالقسم الصحيح عند الإدخال أو الاعتماد.",
      nextStepEn: "Audit student records and enforce correct section at entry or approval.",
    });
  }

  // 5) Monthly concentration
  if (monthSum >= 10 && monthPeakShare >= 0.42) {
    const peakLabel = monthLabelsAr[maxMonthIdx] ?? "";
    pushUnique(out, {
      id: "rec-timing-spread",
      titleAr: "توزيع البرامج والمسابقات على مدار العام",
      titleEn: "Spread programs and contests across the year",
      descriptionAr: `حوالي ${Math.round(monthPeakShare * 100)}% من إنجازات نطاق العام (حسب التاريخ) تتركز في شهر «${peakLabel}» — ما يزيد الضغط التشغيلي ويقلل فرص الإعداد المسبق في بقية الأشهر.`,
      descriptionEn: `About ${Math.round(monthPeakShare * 100)}% of dated in-scope achievements cluster in “${peakLabel}” — operational strain and weaker prep windows elsewhere.`,
      priority: monthPeakShare >= 0.55 ? "high" : "medium",
      category: "timing",
      relatedMetricKey: "monthlyDistribution",
      nextStepAr:
        "بناء روزنامة سنوية للمسابقات والبرامج موزعة على الفصول، مع مواعيد تسجيل مبكرة ومساحة مراجعة قبل الاعتماد.",
      nextStepEn:
        "Publish an annual calendar spread across terms with early registration and review buffers before approval.",
      relatedLabelsAr: peakLabel ? [peakLabel] : [],
    });
  }

  // 6) Level concentration (pyramid)
  if (levelRows.length >= 2 && approvedInYear >= 5) {
    const topL = levelRows[0];
    if (topL.pct >= 62) {
      pushUnique(out, {
        id: "rec-level-pyramid",
        titleAr: "بناء سلم مستويات تدريجي للإنجازات",
        titleEn: "Build a gradual level ladder for achievements",
        descriptionAr: `مستوى «${topL.labelAr}» يهيمن بحوالي ${topL.pct}% على الإنجازات المعتمدة في النطاق — يُفضّل دعم مسار تصعيد من محلي/مدرسي إلى وطني/دولي لتفادي اعتماد قمة بلا قاعدة.`,
        descriptionEn: `Level “${topL.labelEn}” dominates ~${topL.pct}% of approved in scope — strengthen a ladder from school/local upward to national/international.`,
        priority: "medium",
        category: "competition",
        relatedMetricKey: "achievementLevelBreakdown",
        nextStepAr:
          "تعريف مسارات ترشيح داخلية (مدرسة → إقليم → وطني) مع شروط واضحة لكل انتقال.",
        nextStepEn:
          "Define internal nomination ladders (school → regional → national) with explicit gate criteria.",
        relatedLabelsAr: [topL.labelAr],
      });
    }
  }

  // 7) Stage / grade imbalance
  if (stageRows.length >= 2 && approvedInYear >= 8) {
    const sortedStages = [...stageRows].sort((a, b) => a.pct - b.pct);
    const weakest = sortedStages[0];
    const strongest = sortedStages[sortedStages.length - 1];
    if (weakest && strongest && weakest.pct <= 14 && strongest.pct >= 38 && weakest.key !== "unknown") {
      pushUnique(out, {
        id: "rec-stage-target",
        titleAr: `استهداف المرحلة الأقل نشاطًا: ${weakest.labelAr}`,
        titleEn: `Target the least active stage: ${weakest.labelEn}`,
        descriptionAr: `المرحلة «${weakest.labelAr}» تمثل حوالي ${weakest.pct}% فقط من الإنجازات المعتمدة مقابل «${strongest.labelAr}» بحوالي ${strongest.pct}% — يُنصح بخطة استباقية للبرامج والمسابقات في المرحلة الأضعف.`,
        descriptionEn: `Stage “${weakest.labelEn}” is ~${weakest.pct}% of approved vs “${strongest.labelEn}” at ~${strongest.pct}% — proactive programming for the weaker stage.`,
        priority: "medium",
        category: "strategy",
        relatedMetricKey: "stageBreakdown",
        nextStepAr:
          "تخصيص فعاليات إرشاد ومسابقات مبسطة للمرحلة الأقل تمثيلًا مع متابعات شهرية.",
        nextStepEn:
          "Run guided events and lighter contests for the under-represented stage with monthly follow-up.",
        relatedLabelsAr: [weakest.labelAr, strongest.labelAr],
      });
    }
  }

  if (gradeRows.length >= 3 && approvedInYear >= 10) {
    const sortedG = [...gradeRows].sort((a, b) => a.count - b.count);
    const lowG = sortedG[0];
    const highG = sortedG[sortedG.length - 1];
    if (lowG && highG && lowG.count + 2 < highG.count && lowG.count <= Math.ceil(approvedInYear * 0.12)) {
      pushUnique(out, {
        id: "rec-grade-bridge",
        titleAr: `سد فجوة الصفوف: دعم «${lowG.labelAr}»`,
        titleEn: `Bridge grade gaps: support “${lowG.labelEn}”`,
        descriptionAr: `الصف «${lowG.labelAr}» سجّل ${lowG.count} إنجازًا معتمدًا مقابل ${highG.count} في «${highG.labelAr}» — وسّع فرص البرامج الموجهة للصف الأقل نشاطًا لتحسين التسلسل العمري للموهبة.`,
        descriptionEn: `Grade “${lowG.labelEn}” has ${lowG.count} approved vs ${highG.count} in “${highG.labelEn}” — widen grade-targeted programs.`,
        priority: "low",
        category: "program",
        relatedMetricKey: "gradeBreakdown",
        nextStepAr: "تصميم مسارات قصيرة (6–8 أسابيع) لكل صف متأخر عن المتوسط.",
        nextStepEn: "Offer short 6–8 week pathways per under-performing grade band.",
        relatedLabelsAr: [lowG.labelAr, highG.labelAr],
      });
    }
  }

  // 8) Workflow / quality — pending + revision load
  if (totalRecords >= 12) {
    const pipe = statusPending + statusNeedsRevision;
    const pipeRatio = pipe / totalRecords;
    if (pipeRatio >= 0.22) {
      pushUnique(out, {
        id: "rec-pipeline-clarity",
        titleAr: "تخفيف ازدحام المراجعة وتحسين جودة الإدخال",
        titleEn: "Ease review backlog and raise submission quality",
        descriptionAr: `حوالي ${Math.round(pipeRatio * 100)}% من جميع السجلات في حالة «قيد المراجعة» أو «يحتاج تعديلاً» (${pipe} من ${totalRecords}) — يُفضّل إرشاد مسبق للطلاب وقوالب توثيق أوضح لتقليل الدورات المتكررة.`,
        descriptionEn: `About ${Math.round(pipeRatio * 100)}% of all records are pending or need revision (${pipe}/${totalRecords}) — add pre-submission guidance and clearer templates.`,
        priority: pipeRatio >= 0.32 ? "high" : "medium",
        category: "quality",
        relatedMetricKey: "statusMix",
        nextStepAr:
          "نشر قائمة تحقق قبل الرفع، وجلسات توجيه فصلية، ومؤشر زمني مستهدف لإغلاق طلبات التعديل.",
        nextStepEn:
          "Publish a pre-submit checklist, termly briefings, and a target turnaround for revision cycles.",
      });
    }
    const rejRatio = statusRejected / totalRecords;
    if (rejRatio >= 0.1 && statusRejected >= 3) {
      pushUnique(out, {
        id: "rec-rejection-feedback",
        titleAr: "تحليل أسباب الرفض وتقليل التكرار",
        titleEn: "Analyze rejections to reduce recurrence",
        descriptionAr: `نسبة الرفض حوالي ${Math.round(rejRatio * 100)}% (${statusRejected} سجلًا) — راجع أسباب الرفض الشائعة وحدّث أدلة الإرشاد للمسابقات والبرامج.`,
        descriptionEn: `Rejection rate ~${Math.round(rejRatio * 100)}% (${statusRejected} records) — review common causes and update competition/program guidance.`,
        priority: "medium",
        category: "quality",
        relatedMetricKey: "statusMix",
        nextStepAr: "استخراج عينة شهرية من المرفوض مع ورشة تحسين لنموذج الطلب.",
        nextStepEn: "Monthly sample of rejections plus a workshop to improve the submission pattern.",
      });
    }
  }

  // 9) High approval rate in year but low featured — strategic (if not already added strong overlap)
  if (
    approvedShareOfYearPct !== null &&
    approvedShareOfYearPct >= 72 &&
    featuredShareOfApprovedPct !== null &&
    featuredShareOfApprovedPct < 18 &&
    approvedInYear >= 7
  ) {
    pushUnique(out, {
      id: "rec-approval-to-feature-bridge",
      titleAr: "ربط الاعتماد العالي بمسار تمييز منظم",
      titleEn: "Link high approval rate to structured featuring",
      descriptionAr: `نسبة المعتمد من إجمالي نطاق العام مرتفعة (${approvedShareOfYearPct}%) بينما التمييز من المعتمد ${featuredShareOfApprovedPct}% — استغلال الزخم عبر لجنة تمييز دورية تختار قصصًا للنشر.`,
      descriptionEn: `High approved share of year scope (${approvedShareOfYearPct}%) but featuring is ${featuredShareOfApprovedPct}% of approved — capture momentum with a periodic featuring committee.`,
      priority: "medium",
      category: "strategy",
      relatedMetricKey: "approvedShareOfYearPct",
      nextStepAr:
        "تعريف معايير تمييز مرتبطة بالمستوى والمجال، مع جدول عرض ربع سنوي للإدارة.",
      nextStepEn:
        "Define featuring criteria tied to level/field and a quarterly showcase cadence for leadership.",
    });
  }

  out.sort((a, b) => {
    const d = priorityOrder(a.priority) - priorityOrder(b.priority);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });

  return out.slice(0, 14);
};
