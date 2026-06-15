"use client";

type RankingRow = {
  organizationId: string;
  organizationName: string;
  qualityScore: number;
  qualityLabelAr: string;
  qualityLabelEn: string;
  applicantCount: number;
  acceptanceRatePct: number;
  avgStudentRating: number;
  averageResponseTimeDays: number;
  activityScore: number;
};

type ExecutiveWidgetData = {
  partnershipCount: number;
  activeInstitutions: number;
  bestInstitutionName: string;
  weakestInstitutionName: string;
  traineeCount: number;
  avgQualityScore: number;
};

type PartnershipIntelligenceWidgetProps = {
  data: ExecutiveWidgetData | null;
  isAr: boolean;
};

const PartnershipIntelligenceWidget = ({ data, isAr }: PartnershipIntelligenceWidgetProps) => {
  if (!data) return null;

  const cards = [
    { label: isAr ? "عدد الشراكات" : "Partnerships", value: data.partnershipCount },
    { label: isAr ? "مؤسسات نشطة" : "Active institutions", value: data.activeInstitutions },
    { label: isAr ? "أفضل مؤسسة" : "Best institution", value: data.bestInstitutionName },
    { label: isAr ? "أضعف مؤسسة" : "Weakest institution", value: data.weakestInstitutionName },
    { label: isAr ? "المتدربون" : "Trainees", value: data.traineeCount },
    { label: isAr ? "متوسط الجودة" : "Avg quality", value: data.avgQualityScore },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border/70 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold text-text-light">{card.label}</p>
          <p className="mt-1 text-lg font-black text-foreground">{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export type { RankingRow, ExecutiveWidgetData };
export default PartnershipIntelligenceWidget;
