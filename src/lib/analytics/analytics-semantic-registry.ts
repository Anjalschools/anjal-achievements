/**
 * Unified business-facing analytics semantics — single source for labels, tooltips, exports.
 * Localization-ready; components should import from here (or analytics-semantics re-exports).
 */

export type AnalyticsLocale = "ar" | "en";

export type SemanticKey =
  | "page.title"
  | "page.subtitle"
  | "kpi.totalParticipations"
  | "kpi.participatingStudents"
  | "kpi.avgParticipationsPerStudent"
  | "kpi.gold"
  | "kpi.silver"
  | "kpi.bronze"
  | "kpi.medalConversion"
  | "kpi.topActivity"
  | "kpi.topSection"
  | "kpi.peakYear"
  | "kpi.topStdTest"
  | "kpi.intlAchievementsPct"
  | "unit.participation"
  | "unit.student"
  | "unit.medal"
  | "unit.perStudent"
  | "tooltip.participatingStudents"
  | "tooltip.avgParticipationsPerStudent"
  | "section.executiveSummary"
  | "section.hallOfFame"
  | "section.analyticsTable"
  | "section.medalIntelligence"
  | "section.narrativeInsights"
  | "breadcrumb.currentFilters"
  | "breadcrumb.clear"
  | "hall.hero.rank"
  | "hall.badge.topPerformer"
  | "hall.badge.medalLeader"
  | "hall.badge.excellenceAward"
  | "hall.badge.risingTalent"
  | "hall.badge.participationChampion"
  | "export.avgParticipationsPerStudent"
  | "perspective.participation"
  | "perspective.student"
  | "perspective.achievement"
  | "perspective.record"
  | "perspective.result"
  | "perspective.desc.participation"
  | "perspective.desc.student"
  | "perspective.desc.achievement"
  | "perspective.desc.record"
  | "perspective.desc.result"
  | "perspective.level.participation"
  | "perspective.level.student"
  | "perspective.level.achievement"
  | "perspective.level.record"
  | "perspective.level.result"
  | "perspective.banner.title"
  | "column.totalParticipations"
  | "column.studentCount"
  | "column.achievementCount"
  | "column.recordCount"
  | "column.resultCount"
  | "column.participatingStudents"
  | "tooltip.column.participation"
  | "tooltip.column.student"
  | "tooltip.column.achievement"
  | "tooltip.column.record"
  | "tooltip.column.result"
  | "section.demographicMatrix"
  | "section.competitionMatrix"
  | "section.distribution"
  | "section.activityDemographics"
  | "export.totalParticipations"
  | "export.studentCount"
  | "export.recordCount"
  | "dim.section"
  | "dim.gender"
  | "dim.mawhiba"
  | "dim.level"
  | "dim.stage"
  | "export.report.participation"
  | "export.report.student"
  | "export.report.achievement"
  | "export.report.record"
  | "export.report.result"
  | "toolbar.perspective.title"
  | "comparison.workspace.title"
  | "comparison.delta.participation"
  | "comparison.delta.medal"
  | "comparison.delta.conversion"
  | "comparison.delta.density"
  | "comparison.delta.growth"
  | "comparison.delta.representation"
  | "comparison.narrative.lead"
  | "equity.panel.title"
  | "equity.score"
  | "equity.gap.participation"
  | "equity.gap.achievement"
  | "equity.representation.girls"
  | "equity.representation.boys"
  | "equity.representation.mawhiba"
  | "equity.balance.section"
  | "equity.narrative.underrepresentation"
  | "opportunity.panel.title"
  | "opportunity.score"
  | "opportunity.tier.excellent"
  | "opportunity.tier.balanced"
  | "opportunity.tier.warning"
  | "opportunity.tier.critical"
  | "opportunity.category.access_gap"
  | "opportunity.category.representation_gap"
  | "opportunity.category.participation_imbalance"
  | "opportunity.category.opportunity_concentration"
  | "opportunity.category.diversity_warning"
  | "opportunity.heatmap.title"
  | "opportunity.concentration.title"
  | "opportunity.recommendations.title"
  | "opportunity.gap.access"
  | "opportunity.gap.representation"
  | "opportunity.concentration.ratio"
  | "opportunity.delta.representation"
  | "opportunity.delta.access"
  | "opportunity.delta.diversity"
  | "opportunity.delta.concentration"
  | "opportunity.delta.spread"
  | "recommendation.panel.title"
  | "recommendation.score"
  | "recommendation.heatmap.title"
  | "recommendation.category.participation"
  | "recommendation.category.equity"
  | "recommendation.category.diversity"
  | "recommendation.category.expansion"
  | "recommendation.category.talent"
  | "recommendation.category.representation"
  | "recommendation.severity.info"
  | "recommendation.severity.moderate"
  | "recommendation.severity.high"
  | "recommendation.severity.critical"
  | "recommendation.delta.participation_improvement"
  | "recommendation.delta.equity_improvement"
  | "recommendation.delta.opportunity_expansion"
  | "workspace.nav.title"
  | "workspace.density.title"
  | "workspace.density.executive"
  | "workspace.density.standard"
  | "workspace.density.deep"
  | "workspace.summary.title"
  | "workspace.summary.risks"
  | "workspace.summary.opportunities"
  | "workspace.summary.recommendations"
  | "workspace.summary.topInsight"
  | "workspace.layer.1"
  | "workspace.layer.2"
  | "workspace.layer.3"
  | "workspace.layer.4"
  | "workspace.layer.5"
  | "workspace.layer.6"
  | "recommendation.tier.critical"
  | "recommendation.tier.high"
  | "recommendation.tier.medium"
  | "recommendation.tier.info"
  | "recommendation.executive.top3"
  | "score.explain.equity"
  | "score.explain.opportunity"
  | "score.explain.recommendation"
  | "comparison.dominant"
  | "comparison.summary"
  | "comparison.narrative.executive"
  | "dim.key.arabic"
  | "dim.key.international"
  | "dim.key.male"
  | "dim.key.female"
  | "dim.key.mawhiba_yes"
  | "dim.key.mawhiba_no"
  | "heatmap.intensity"
  | "heatmap.equity"
  | "historical.workspace.title"
  | "historical.workspace.hint"
  | "historical.mode"
  | "historical.dimension"
  | "historical.activity"
  | "historical.years"
  | "historical.loading"
  | "historical.empty"
  | "historical.matrix.title"
  | "historical.tab"
  | "metric.participation"
  | "metric.gold"
  | "metric.silver"
  | "metric.bronze"
  | "metric.nomination"
  | "metric.acceptance"
  | "metric.conversion"
  | "row.total";

const STRINGS: Record<SemanticKey, Record<AnalyticsLocale, string>> = {
  "page.title": {
    ar: "مساحة الذكاء التعليمي التنفيذي",
    en: "Executive Educational Intelligence Workspace",
  },
  "page.subtitle": {
    ar: "نظام تشغيل قرارات تعليمية — مؤشرات · عدالة · فرص · توصيات قابلة للتنفيذ",
    en: "Educational decision operating system — KPIs · equity · opportunities · actionable recommendations",
  },
  "kpi.totalParticipations": {
    ar: "إجمالي المشاركات",
    en: "Total participations",
  },
  "kpi.participatingStudents": {
    ar: "الطلاب المشاركون",
    en: "Participating students",
  },
  "kpi.avgParticipationsPerStudent": {
    ar: "متوسط المشاركات لكل طالب",
    en: "Avg. participations per student",
  },
  "kpi.gold": { ar: "🥇 ذهبية", en: "🥇 Gold" },
  "kpi.silver": { ar: "🥈 فضية", en: "🥈 Silver" },
  "kpi.bronze": { ar: "🥉 برونزية", en: "🥉 Bronze" },
  "kpi.medalConversion": { ar: "معدل التحويل إلى ميداليات", en: "Medal conversion rate" },
  "kpi.topActivity": { ar: "أعلى نشاط", en: "Top activity" },
  "kpi.topSection": { ar: "أعلى قسم", en: "Top section" },
  "kpi.peakYear": { ar: "أعلى سنة", en: "Peak year" },
  "kpi.topStdTest": { ar: "أعلى اختبار معياري", en: "Top std. test" },
  "kpi.intlAchievementsPct": { ar: "إنجازات دولية %", en: "Intl. achievements %" },
  "unit.participation": { ar: "مشاركة", en: "participations" },
  "unit.student": { ar: "طالب", en: "students" },
  "unit.medal": { ar: "ميدالية", en: "medals" },
  "unit.perStudent": { ar: "مشاركة/طالب", en: "participations/student" },
  "tooltip.participatingStudents": {
    ar: "عدد الطلاب المختلفين بعد إزالة تكرار المشاركات",
    en: "Count of distinct students after deduplicating participation records",
  },
  "tooltip.avgParticipationsPerStudent": {
    ar: "إجمالي المشاركات ÷ الطلاب المشاركين — يقيس كثافة المشاركة الفردية",
    en: "Total participations ÷ participating students — measures individual participation density",
  },
  "section.executiveSummary": { ar: "الملخص التنفيذي", en: "Executive summary" },
  "section.hallOfFame": { ar: "قاعة التميز الطلابي", en: "Student excellence hall" },
  "section.analyticsTable": { ar: "الجدول التحليلي", en: "Analytics table" },
  "section.medalIntelligence": { ar: "ذكاء الميداليات", en: "Medal intelligence" },
  "section.narrativeInsights": { ar: "رؤى تنفيذية ذكية", en: "Executive intelligence narratives" },
  "breadcrumb.currentFilters": { ar: "الفلاتر الحالية:", en: "Current filters:" },
  "breadcrumb.clear": { ar: "مسح", en: "Clear" },
  "hall.hero.rank": { ar: "الأول", en: "#1" },
  "hall.badge.topPerformer": { ar: "أفضل أداء", en: "Top Performer" },
  "hall.badge.medalLeader": { ar: "قائد الميداليات", en: "Medal Leader" },
  "hall.badge.excellenceAward": { ar: "جائزة التميز", en: "Excellence Award" },
  "hall.badge.risingTalent": { ar: "موهبة صاعدة", en: "Rising Talent" },
  "hall.badge.participationChampion": { ar: "بطل المشاركة", en: "Participation Champion" },
  "export.avgParticipationsPerStudent": {
    ar: "متوسط المشاركات لكل طالب",
    en: "Average participations per student",
  },
  "perspective.participation": { ar: "المشاركات", en: "Participations" },
  "perspective.student": { ar: "الطلاب", en: "Students" },
  "perspective.achievement": { ar: "الإنجازات", en: "Achievements" },
  "perspective.record": { ar: "السجلات", en: "Records" },
  "perspective.result": { ar: "النتائج", en: "Results" },
  "perspective.desc.participation": {
    ar: "كل صف يمثل عدد مشاركات (سجل مشاركة واحد لكل إدخال)",
    en: "Each row counts participation records (one record per entry)",
  },
  "perspective.desc.student": {
    ar: "كل صف يمثل عدد الطلاب المختلفين (بدون تكرار)",
    en: "Each row counts distinct participating students (deduplicated)",
  },
  "perspective.desc.achievement": {
    ar: "كل صف يمثل عدد الإنجازات المعتمدة",
    en: "Each row counts approved achievements",
  },
  "perspective.desc.record": {
    ar: "كل صف يمثل عدد السجلات الخام في النظام",
    en: "Each row counts raw system records",
  },
  "perspective.desc.result": {
    ar: "كل صف يمثل عدد النتائج (ميداليات + مراكز)",
    en: "Each row counts scored outcomes (medals + ranks)",
  },
  "perspective.level.participation": { ar: "مستوى المشاركة", en: "Participation-level" },
  "perspective.level.student": { ar: "مستوى الطالب", en: "Student-level" },
  "perspective.level.achievement": { ar: "مستوى الإنجاز", en: "Achievement-level" },
  "perspective.level.record": { ar: "مستوى السجل", en: "Record-level" },
  "perspective.level.result": { ar: "مستوى النتيجة", en: "Result-level" },
  "perspective.banner.title": {
    ar: "منظور العد الحالي",
    en: "Current counting perspective",
  },
  "column.totalParticipations": { ar: "إجمالي المشاركات", en: "Total participations" },
  "column.studentCount": { ar: "عدد الطلاب", en: "Student count" },
  "column.achievementCount": { ar: "عدد الإنجازات", en: "Achievement count" },
  "column.recordCount": { ar: "عدد السجلات", en: "Record count" },
  "column.resultCount": { ar: "عدد النتائج", en: "Result count" },
  "column.participatingStudents": { ar: "الطلاب المشاركون", en: "Participating students" },
  "tooltip.column.participation": {
    ar: "مجموع سجلات المشاركة لهذا النشاط ضمن الفلاتر",
    en: "Sum of participation records for this activity under filters",
  },
  "tooltip.column.student": {
    ar: "عدد الطلاب المختلفين الذين شاركوا في هذا النشاط",
    en: "Distinct students who participated in this activity",
  },
  "tooltip.column.achievement": {
    ar: "عدد الإنجازات المعتمدة المرتبطة بالنشاط",
    en: "Approved achievements linked to the activity",
  },
  "tooltip.column.record": {
    ar: "عدد السجلات — يعادل المشاركات في معظم الأنشطة",
    en: "Record count — equivalent to participations for most activities",
  },
  "tooltip.column.result": {
    ar: "مجموع الميداليات والمراكز كنتائج قابلة للقياس",
    en: "Sum of medals and rank placements as measurable outcomes",
  },
  "section.demographicMatrix": {
    ar: "مصفوفة الذكاء الديموغرافي التعليمي",
    en: "Educational demographic intelligence matrix",
  },
  "section.competitionMatrix": {
    ar: "مصفوفة ذكاء المسابقات",
    en: "Competition intelligence matrix",
  },
  "section.distribution": {
    ar: "توزيع المشاركات",
    en: "Participation distribution",
  },
  "section.activityDemographics": {
    ar: "تحليل الأنشطة متعدد الأبعاد",
    en: "Multi-dimensional activity analytics",
  },
  "export.totalParticipations": { ar: "إجمالي المشاركات", en: "Total participations" },
  "export.studentCount": { ar: "عدد الطلاب", en: "Student count" },
  "export.recordCount": { ar: "عدد السجلات", en: "Record count" },
  "dim.section": { ar: "القسم", en: "Section" },
  "dim.gender": { ar: "الجنس", en: "Gender" },
  "dim.mawhiba": { ar: "الموهبة", en: "Mawhiba" },
  "dim.level": { ar: "المستوى / الصف", en: "Level / grade" },
  "dim.stage": { ar: "المرحلة", en: "Stage" },
  "export.report.participation": {
    ar: "تقرير منظور المشاركات",
    en: "Participations perspective report",
  },
  "export.report.student": {
    ar: "تقرير منظور الطلاب",
    en: "Students perspective report",
  },
  "export.report.achievement": {
    ar: "تقرير منظور الإنجازات",
    en: "Achievements perspective report",
  },
  "export.report.record": {
    ar: "تقرير منظور السجلات",
    en: "Records perspective report",
  },
  "export.report.result": {
    ar: "تقرير منظور النتائج",
    en: "Results perspective report",
  },
  "toolbar.perspective.title": {
    ar: "منظور التحليل العام",
    en: "Global analytics perspective",
  },
  "comparison.workspace.title": {
    ar: "مساحة المقارنة التعليمية",
    en: "Educational comparison workspace",
  },
  "comparison.delta.participation": { ar: "فرق المشاركات", en: "Participation delta" },
  "comparison.delta.medal": { ar: "فرق الميداليات", en: "Medal delta" },
  "comparison.delta.conversion": { ar: "فرق التحويل", en: "Conversion delta" },
  "comparison.delta.density": { ar: "فرق الكثافة", en: "Density delta" },
  "comparison.delta.growth": { ar: "فرق النمو", en: "Growth delta" },
  "comparison.delta.representation": { ar: "فرق التمثيل", en: "Representation delta" },
  "comparison.narrative.lead": { ar: "يتفوق", en: "leads" },
  "equity.panel.title": {
    ar: "ذكاء العدالة التعليمية",
    en: "Educational equity intelligence",
  },
  "equity.score": { ar: "مؤشر العدالة التعليمية", en: "Educational equity score" },
  "equity.gap.participation": { ar: "فجوة المشاركة", en: "Participation gap" },
  "equity.gap.achievement": { ar: "فجوة الإنجاز", en: "Achievement gap" },
  "equity.representation.girls": { ar: "تمثيل البنات", en: "Girls representation" },
  "equity.representation.boys": { ar: "تمثيل البنين", en: "Boys representation" },
  "equity.representation.mawhiba": { ar: "تمثيل الموهبة", en: "Mawhiba representation" },
  "equity.balance.section": { ar: "توازن الأقسام", en: "Section balance" },
  "equity.narrative.underrepresentation": {
    ar: "تمثيل أقل من المتوقع",
    en: "Below-expected representation",
  },
  "opportunity.panel.title": {
    ar: "ذكاء الفرص التعليمية",
    en: "Educational opportunity intelligence",
  },
  "opportunity.score": {
    ar: "مؤشر الفرص التعليمية",
    en: "Educational opportunity score",
  },
  "opportunity.tier.excellent": { ar: "ممتاز", en: "Excellent" },
  "opportunity.tier.balanced": { ar: "متوازن", en: "Balanced" },
  "opportunity.tier.warning": { ar: "تحذير", en: "Warning" },
  "opportunity.tier.critical": { ar: "حرج", en: "Critical" },
  "opportunity.category.access_gap": { ar: "فجوات الوصول", en: "Access gaps" },
  "opportunity.category.representation_gap": { ar: "فجوات التمثيل", en: "Representation gaps" },
  "opportunity.category.participation_imbalance": { ar: "اختلال المشاركة", en: "Participation imbalance" },
  "opportunity.category.opportunity_concentration": { ar: "تركز الفرص", en: "Opportunity concentration" },
  "opportunity.category.diversity_warning": { ar: "تحذيرات التنوع", en: "Diversity warnings" },
  "opportunity.heatmap.title": { ar: "خريطة حرارية للوصول", en: "Opportunity access heatmap" },
  "opportunity.concentration.title": { ar: "احتكار الأنشطة", en: "Activity concentration" },
  "opportunity.recommendations.title": { ar: "توصيات توسيع الفرص", en: "Opportunity expansion recommendations" },
  "opportunity.gap.access": { ar: "فجوة وصول", en: "Access gap" },
  "opportunity.gap.representation": { ar: "فجوة تمثيل", en: "Representation gap" },
  "opportunity.concentration.ratio": { ar: "نسبة التركز", en: "Concentration ratio" },
  "opportunity.delta.representation": { ar: "فرق التمثيل", en: "Representation delta" },
  "opportunity.delta.access": { ar: "فرق الوصول", en: "Access delta" },
  "opportunity.delta.diversity": { ar: "فرق التنوع", en: "Diversity delta" },
  "opportunity.delta.concentration": { ar: "فرق التركز", en: "Concentration delta" },
  "opportunity.delta.spread": { ar: "انتشار الفرص", en: "Opportunity spread" },
  "recommendation.panel.title": {
    ar: "ذكاء التوصيات التعليمية",
    en: "Educational recommendation intelligence",
  },
  "recommendation.score": {
    ar: "مؤشر التوصيات التعليمية",
    en: "Educational recommendation score",
  },
  "recommendation.heatmap.title": {
    ar: "خريطة الفرص والتوصيات",
    en: "Opportunity & recommendation heatmap",
  },
  "recommendation.category.participation": {
    ar: "توصيات المشاركة",
    en: "Participation recommendations",
  },
  "recommendation.category.equity": {
    ar: "توصيات العدالة",
    en: "Equity recommendations",
  },
  "recommendation.category.diversity": {
    ar: "توصيات التنوع",
    en: "Diversity recommendations",
  },
  "recommendation.category.expansion": {
    ar: "توصيات التوسعة",
    en: "Expansion recommendations",
  },
  "recommendation.category.talent": {
    ar: "اكتشاف المواهب",
    en: "Talent discovery",
  },
  "recommendation.category.representation": {
    ar: "توصيات التمثيل",
    en: "Representation recommendations",
  },
  "recommendation.severity.info": { ar: "معلومة", en: "Info" },
  "recommendation.severity.moderate": { ar: "متوسط", en: "Moderate" },
  "recommendation.severity.high": { ar: "مرتفع", en: "High" },
  "recommendation.severity.critical": { ar: "حرج", en: "Critical" },
  "recommendation.delta.participation_improvement": {
    ar: "فرص تحسين المشاركة",
    en: "Participation improvement",
  },
  "recommendation.delta.equity_improvement": {
    ar: "مؤشر التوصيات",
    en: "Recommendation index",
  },
  "recommendation.delta.opportunity_expansion": {
    ar: "احتياج التوسع",
    en: "Expansion need",
  },
  "workspace.nav.title": {
    ar: "تنقل الذكاء التنفيذي",
    en: "Intelligence navigation",
  },
  "workspace.density.title": { ar: "كثافة العرض", en: "View density" },
  "workspace.density.executive": { ar: "تنفيذي", en: "Executive" },
  "workspace.density.standard": { ar: "قياسي", en: "Standard" },
  "workspace.density.deep": { ar: "تحليل عميق", en: "Deep analysis" },
  "workspace.summary.title": {
    ar: "ملخص الذكاء التنفيذي",
    en: "Executive intelligence summary",
  },
  "workspace.summary.risks": { ar: "أهم المخاطر", en: "Top risks" },
  "workspace.summary.opportunities": { ar: "أهم الفرص", en: "Top opportunities" },
  "workspace.summary.recommendations": { ar: "أهم التوصيات", en: "Top recommendations" },
  "workspace.summary.topInsight": { ar: "أهم رؤية", en: "Top insight" },
  "workspace.layer.1": { ar: "المؤشرات التنفيذية", en: "Executive KPIs" },
  "workspace.layer.2": { ar: "رؤى وتنبيهات", en: "Insights & alerts" },
  "workspace.layer.3": { ar: "العدالة والفرص", en: "Equity & opportunity" },
  "workspace.layer.4": { ar: "التوصيات والإجراءات", en: "Recommendations & actions" },
  "workspace.layer.5": { ar: "المقارنة والتحليل العميق", en: "Comparison & deep analytics" },
  "workspace.layer.6": { ar: "الجداول والاستكشاف", en: "Tables & drill-down" },
  "recommendation.tier.critical": { ar: "إجراءات حرجة", en: "Critical actions" },
  "recommendation.tier.high": { ar: "أثر مرتفع", en: "High impact" },
  "recommendation.tier.medium": { ar: "أثر متوسط", en: "Medium impact" },
  "recommendation.tier.info": { ar: "معلوماتي", en: "Informational" },
  "recommendation.executive.top3": {
    ar: "أهم 3 توصيات تنفيذية",
    en: "Top 3 executive recommendations",
  },
  "score.explain.equity": { ar: "تفسير مؤشر العدالة", en: "Equity score breakdown" },
  "score.explain.opportunity": {
    ar: "تفسير مؤشر الفرص",
    en: "Opportunity score breakdown",
  },
  "score.explain.recommendation": {
    ar: "تفسير مؤشر التوصيات",
    en: "Recommendation score breakdown",
  },
  "comparison.dominant": { ar: "الجانب الأقوى", en: "Dominant side" },
  "comparison.summary": { ar: "ملخص المقارنة", en: "Comparison summary" },
  "comparison.narrative.executive": {
    ar: "سرد تنفيذي للمقارنة",
    en: "Executive comparison narrative",
  },
  "dim.key.arabic": { ar: "القسم العربي", en: "Arabic section" },
  "dim.key.international": { ar: "القسم الدولي", en: "International section" },
  "dim.key.male": { ar: "البنين", en: "Boys" },
  "dim.key.female": { ar: "البنات", en: "Girls" },
  "dim.key.mawhiba_yes": { ar: "موهبة", en: "Mawhiba" },
  "dim.key.mawhiba_no": { ar: "غير موهبة", en: "Non-Mawhiba" },
  "heatmap.intensity": { ar: "شدة الخريطة", en: "Heatmap intensity" },
  "heatmap.equity": { ar: "خريطة العدالة", en: "Equity heatmap" },
  "historical.workspace.title": {
    ar: "إحصائيات ونتائج المسابقات للمقارنة",
    en: "Competition Results Intelligence",
  },
  "historical.workspace.hint": {
    ar: "مقارنة تاريخية للمشاركة · التأهل · التتويج · القبول عبر السنوات",
    en: "Historical participation · qualification · awards · acceptance across years",
  },
  "historical.mode": { ar: "وضع العرض", en: "View mode" },
  "historical.dimension": { ar: "البُعد", en: "Dimension" },
  "historical.activity": { ar: "النشاط", en: "Activity" },
  "historical.years": { ar: "السنوات", en: "Years" },
  "historical.loading": {
    ar: "جاري تحميل نتائج المسابقات التاريخية…",
    en: "Loading competition results…",
  },
  "historical.empty": {
    ar: "لا توجد نتائج مسابقات مطابقة للفلاتر الحالية.",
    en: "No competition results match the current filters.",
  },
  "historical.matrix.title": {
    ar: "مصفوفة المقارنة بين الأنشطة",
    en: "Cross-activity comparison matrix",
  },
  "historical.tab": {
    ar: "إحصائيات ونتائج المسابقات",
    en: "Competition Results",
  },
  "metric.participation": { ar: "مشاركة", en: "Participation" },
  "metric.gold": { ar: "ذهبية", en: "Gold" },
  "metric.silver": { ar: "فضية", en: "Silver" },
  "metric.bronze": { ar: "برونزية", en: "Bronze" },
  "metric.nomination": { ar: "ترشيح", en: "Nomination" },
  "metric.acceptance": { ar: "قبول", en: "Acceptance" },
  "metric.conversion": { ar: "تحويل", en: "Conversion" },
  "row.total": { ar: "المجموع", en: "Total" },
};

const DIMENSION_KEY_MAP: Record<string, SemanticKey> = {
  arabic: "dim.key.arabic",
  international: "dim.key.international",
  male: "dim.key.male",
  female: "dim.key.female",
  boys: "dim.key.male",
  girls: "dim.key.female",
  yes: "dim.key.mawhiba_yes",
  no: "dim.key.mawhiba_no",
  mawhiba: "dim.key.mawhiba_yes",
};

/** Normalize raw chart keys to executive-friendly labels */
export const normalizeDimensionLabel = (
  rawKey: string,
  loc: AnalyticsLocale,
  fallbackAr?: string,
  fallbackEn?: string
): string => {
  const k = rawKey.toLowerCase().trim();
  const semantic = DIMENSION_KEY_MAP[k];
  if (semantic) return t(semantic, loc);
  if (loc === "ar" && fallbackAr) return fallbackAr;
  if (fallbackEn) return fallbackEn;
  return rawKey;
};

export const t = (key: SemanticKey, loc: AnalyticsLocale): string => STRINGS[key][loc];

export const formatMetricWithUnit = (
  value: number | string,
  unitKey: "unit.participation" | "unit.student" | "unit.medal" | "unit.perStudent",
  loc: AnalyticsLocale
): string => `${value} ${t(unitKey, loc)}`;

export const formatParticipationCount = (n: number, loc: AnalyticsLocale): string =>
  formatMetricWithUnit(n, "unit.participation", loc);

export const formatStudentCount = (n: number, loc: AnalyticsLocale): string =>
  formatMetricWithUnit(n, "unit.student", loc);

export const formatMedalCount = (n: number, loc: AnalyticsLocale): string =>
  formatMetricWithUnit(n, "unit.medal", loc);

export const formatAvgParticipationsPerStudent = (avg: number, loc: AnalyticsLocale): string =>
  formatMetricWithUnit(avg, "unit.perStudent", loc);

export const formatNonMedalParticipations = (n: number, loc: AnalyticsLocale): string =>
  loc === "ar" ? `${n} مشاركة بدون ميدالية` : `${n} participations without medals`;

/** @deprecated Use registry — kept for backward compatibility */
export const uniqueStudentsLabel = (loc: AnalyticsLocale): string =>
  t("kpi.participatingStudents", loc);

export const uniqueStudentsTooltip = (loc: AnalyticsLocale): string =>
  t("tooltip.participatingStudents", loc);

export const pageTitle = (loc: AnalyticsLocale): string => t("page.title", loc);

export const pageSubtitle = (loc: AnalyticsLocale): string => t("page.subtitle", loc);

export const computeAvgParticipationsPerStudent = (
  participationCount: number,
  uniqueStudentsCount: number
): number => {
  if (uniqueStudentsCount <= 0) return 0;
  return Math.round((participationCount / uniqueStudentsCount) * 100) / 100;
};

export const formatAvgParticipationsPerStudentLine = (
  participationCount: number,
  uniqueStudentsCount: number,
  loc: AnalyticsLocale
): string => {
  const avg = computeAvgParticipationsPerStudent(participationCount, uniqueStudentsCount);
  const div = loc === "ar" ? "÷" : "/";
  return `${participationCount} ${t("unit.participation", loc)} ${div} ${uniqueStudentsCount} ${t("unit.student", loc)} = ${avg}`;
};
