import type { ImprovementAction, RoadmapItem } from "@/lib/school-improvement/school-improvement-types";

const QUARTER_LABELS = (year: number) => [
  { ar: `الربع الأول ${year}`, en: `Q1 ${year}` },
  { ar: `الربع الثاني ${year}`, en: `Q2 ${year}` },
  { ar: `الربع الثالث ${year}`, en: `Q3 ${year}` },
  { ar: `الربع الرابع ${year}`, en: `Q4 ${year}` },
];

const MONTH_LABELS = (year: number) => {
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  const en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const items: Array<{ ar: string; en: string; key: string }> = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth();
    items.push({
      ar: `${months[m]} ${d.getFullYear()}`,
      en: `${en[m]} ${d.getFullYear()}`,
      key: `${d.getFullYear()}-M${m + 1}`,
    });
  }
  return items;
};

const sortByPriority = (actions: ImprovementAction[]) =>
  [...actions].sort((a, b) => {
    const p = { high: 3, medium: 2, low: 1 };
    return p[b.priority] - p[a.priority];
  });

export const buildStrategicRoadmap = (actions: ImprovementAction[]): RoadmapItem[] => {
  const sorted = sortByPriority(actions);
  const year = new Date().getFullYear();
  const roadmap: RoadmapItem[] = [];

  const quarters = QUARTER_LABELS(year);
  quarters.forEach((q, idx) => {
    const slice = sorted.slice(idx * 4, idx * 4 + 4);
    roadmap.push({
      id: `roadmap-annual-q${idx + 1}`,
      period: `Q${idx + 1}-${year}`,
      periodLabelAr: q.ar,
      periodLabelEn: q.en,
      horizon: "annual",
      actions: slice.map((a) => ({
        actionId: a.id,
        titleAr: a.recommendationAr,
        titleEn: a.recommendationEn,
        priority: a.priority,
      })),
    });
  });

  const highPriority = sorted.filter((a) => a.priority === "high").slice(0, 9);
  for (let q = 0; q < 3; q++) {
    const slice = highPriority.slice(q * 3, q * 3 + 3);
    roadmap.push({
      id: `roadmap-quarter-${q + 1}`,
      period: `quarter-${q + 1}-${year}`,
      periodLabelAr: quarters[q].ar,
      periodLabelEn: quarters[q].en,
      horizon: "quarterly",
      actions: slice.map((a) => ({
        actionId: a.id,
        titleAr: a.recommendationAr,
        titleEn: a.recommendationEn,
        priority: a.priority,
      })),
    });
  }

  const months = MONTH_LABELS(year);
  months.forEach((m, idx) => {
    const slice = sorted.slice(idx * 2, idx * 2 + 2);
    roadmap.push({
      id: `roadmap-month-${m.key}`,
      period: m.key,
      periodLabelAr: m.ar,
      periodLabelEn: m.en,
      horizon: "monthly",
      actions: slice.map((a) => ({
        actionId: a.id,
        titleAr: a.recommendationAr,
        titleEn: a.recommendationEn,
        priority: a.priority,
      })),
    });
  });

  return roadmap;
};
