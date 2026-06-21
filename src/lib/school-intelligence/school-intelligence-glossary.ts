export type SchoolIntelligenceGlossaryEntry = {
  key: string;
  termAr: string;
  termEn: string;
  definitionAr: string;
  definitionEn: string;
};

export const SCHOOL_INTELLIGENCE_GLOSSARY: SchoolIntelligenceGlossaryEntry[] = [
  {
    key: "ssi",
    termAr: "مؤشر نجاح الطالب (SSI)",
    termEn: "Student Success Index (SSI)",
    definitionAr:
      "مؤشر مركّب لنجاح الطالب يعتمد على الإنجازات والمشاركة والثبات وأداء المنافسات. كلما ارتفع المؤشر زادت قوة ملف النجاح.",
    definitionEn:
      "Composite student success indicator using achievements, participation, consistency, and competition performance. Higher scores indicate stronger success profiles.",
  },
  {
    key: "health_score",
    termAr: "مؤشر الصحة",
    termEn: "Health Score",
    definitionAr:
      "يقيس موثوقية مخرجات الذكاء المدرسي بناءً على نجاح الأقسام واكتمال البيانات وجودة التشخيصات وحالة الاسترداد. المدى: 0–100.",
    definitionEn:
      "Measures overall reliability of intelligence outputs based on successful sections, data completeness, diagnostics quality, and recovery status. Range: 0–100.",
  },
  {
    key: "intelligence_score",
    termAr: "مؤشر الذكاء",
    termEn: "Intelligence Score",
    definitionAr:
      "يقيس ثراء التحليلات المدرسية من حيث الرؤى الاستراتيجية وتغطية الاتجاهات والفرص وعمق تحليلات الطلاب. المدى: 0–100.",
    definitionEn:
      "Measures analytical richness through generated insights, trend coverage, opportunity coverage, and student analytics depth. Range: 0–100.",
  },
  {
    key: "talent_candidate",
    termAr: "مرشح موهبة",
    termEn: "Talent Candidate",
    definitionAr:
      "طالب يظهر إمكانات استثنائية وفق معايير محددة مثل النمو السريع أو الجاهزية العالية مع مشاركة محدودة أو ملاءمة للبرامج النوعية.",
    definitionEn:
      "A student showing exceptional potential via rapid growth, high readiness with limited participation, or suitability for specialized programs.",
  },
  {
    key: "growth_rate",
    termAr: "معدل النمو",
    termEn: "Growth Rate",
    definitionAr: "نسبة التغير في المشاركة أو الإنجاز أو التفاعل عبر السنوات.",
    definitionEn: "Rate of change in participation, achievement, or engagement across years.",
  },
  {
    key: "participation_rate",
    termAr: "معدل المشاركة",
    termEn: "Participation Rate",
    definitionAr: "نسبة الطلاب النشطين مقارنة بإجمالي الطلاب في شبكة الذكاء المدرسي.",
    definitionEn: "Share of active students compared to total students in the school intelligence network.",
  },
  {
    key: "intervention_priority",
    termAr: "أولوية التدخل",
    termEn: "Intervention Priority",
    definitionAr:
      "درجة إلحاح الدعم للطالب بناءً على تراجع المشاركة أو انخفاض SSI أو غياب النمو أو ضياع الفرص.",
    definitionEn:
      "Urgency of support based on declining participation, low SSI, lack of growth, or missed opportunities.",
  },
  {
    key: "opportunity_coverage",
    termAr: "تغطية الفرص",
    termEn: "Opportunity Coverage",
    definitionAr: "مدى توافر واستغلال البرامج والمسابقات والأنشطة الإثرائية داخل شبكة الذكاء.",
    definitionEn: "Extent to which programs, competitions, and enrichment activities are available and utilized.",
  },
  {
    key: "strategic_insight",
    termAr: "رؤية استراتيجية",
    termEn: "Strategic Insight",
    definitionAr: "استنتاج تحليلي قابل للتفسير يدعم القرار المدرسي ويرتبط بأدلة محددة.",
    definitionEn: "An explainable analytical conclusion supporting school decisions with specific evidence.",
  },
  {
    key: "excellence_index",
    termAr: "مؤشر التميز",
    termEn: "Excellence Index",
    definitionAr: "مؤشر مركّب لتميز المدرسة أو القسم أو المسار وفق المشاركة والإنجاز وSSI والنمو.",
    definitionEn: "Composite excellence indicator for school, department, or pathway based on participation, achievements, SSI, and growth.",
  },
];

export type SchoolIntelligenceMetricHelpKey =
  | "health_score"
  | "intelligence_score"
  | "ssi"
  | "intervention_engine"
  | "opportunity_map"
  | "longitudinal_growth"
  | "department_excellence"
  | "talent_discovery"
  | "school_excellence"
  | "participation_rate";

export const SCHOOL_INTELLIGENCE_METRIC_HELP: Record<
  SchoolIntelligenceMetricHelpKey,
  { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }
> = {
  health_score: {
    titleAr: "مؤشر الصحة",
    titleEn: "Health Score",
    bodyAr:
      "يقيس موثوقية مخرجات الذكاء المدرسي: نجاح الأقسام، اكتمال البيانات، جودة التشخيصات، وحالة الاسترداد. المدى 0–100.",
    bodyEn:
      "Measures reliability of intelligence outputs: successful sections, data completeness, diagnostics quality, and recovery status. Range 0–100.",
  },
  intelligence_score: {
    titleAr: "مؤشر الذكاء",
    titleEn: "Intelligence Score",
    bodyAr:
      "يقيس ثراء التحليل: الرؤى المولّدة، تغطية الاتجاهات، تغطية الفرص، وعمق تحليلات الطلاب. المدى 0–100.",
    bodyEn:
      "Measures analytical richness: generated insights, trend coverage, opportunity coverage, and student analytics depth. Range 0–100.",
  },
  ssi: {
    titleAr: "مؤشر نجاح الطالب (SSI)",
    titleEn: "Student Success Index (SSI)",
    bodyAr: "مؤشر مركّب يستخدم الإنجازات والمشاركة والثبات وأداء المنافسات. كلما ارتفع كان ملف النجاح أقوى.",
    bodyEn: "Composite indicator using achievements, participation, consistency, and competition performance.",
  },
  intervention_engine: {
    titleAr: "محرك التدخل",
    titleEn: "Intervention Engine",
    bodyAr: "يحدد الطلاب الذين يحتاجون دعماً بسبب تراجع المشاركة أو انخفاض SSI أو غياب النمو أو ضياع الفرص.",
    bodyEn: "Identifies students needing support due to declining participation, low SSI, lack of growth, or missed opportunities.",
  },
  opportunity_map: {
    titleAr: "خريطة الفرص",
    titleEn: "Opportunity Map",
    bodyAr: "تعرض البرامج والمسابقات والأنشطة الإثرائية ذات أعلى إمكانية للمشاركة.",
    bodyEn: "Shows programs, competitions, and enrichment activities with the highest participation potential.",
  },
  longitudinal_growth: {
    titleAr: "النمو الطولي",
    titleEn: "Longitudinal Growth",
    bodyAr: "يتتبع النمو عبر السنوات: نمو المشاركة، نمو الإنجاز، ونمو تفاعل الطلاب.",
    bodyEn: "Tracks growth across years: participation growth, achievement growth, and student engagement growth.",
  },
  department_excellence: {
    titleAr: "تميز الأقسام",
    titleEn: "Department Excellence",
    bodyAr: "يرتّب الأقسام والمسارات وفق المشاركة والإنجازات وأداء SSI ومعدل النمو.",
    bodyEn: "Ranks departments and pathways by participation, achievements, SSI performance, and growth rate.",
  },
  talent_discovery: {
    titleAr: "اكتشاف المواهب",
    titleEn: "Talent Discovery",
    bodyAr:
      "يكشف الطلاب ذوي الإمكانات الاستثنائية عبر الإنجاز المستدام والنمو السريع وأداء المنافسات المتقدم وأنماط المشاركة.",
    bodyEn:
      "Identifies students with exceptional potential via sustained achievement, rapid growth, competition performance, and participation patterns.",
  },
  school_excellence: {
    titleAr: "تميز المدرسة",
    titleEn: "School Excellence",
    bodyAr: "مؤشر مركّب لتميز المدرسة يجمع بين SSI ومعدل المشاركة والنمو السنوي.",
    bodyEn: "Composite school excellence indicator combining SSI, participation rate, and year-over-year growth.",
  },
  participation_rate: {
    titleAr: "معدل المشاركة",
    titleEn: "Participation Rate",
    bodyAr: "نسبة الطلاب النشطين مقارنة بإجمالي الطلاب في شبكة الذكاء.",
    bodyEn: "Share of active students compared to total students in the intelligence network.",
  },
};

export const TALENT_DISCOVERY_NO_DATA_MESSAGE = {
  ar: "لا تتوفر بيانات كافية حالياً لاكتشاف المواهب بشكل موثوق. سيظهر هذا المؤشر تلقائياً عند توفر بيانات إضافية.",
  en: "Not enough reliable data is available for talent discovery yet. This indicator will appear automatically when additional data becomes available.",
} as const;
