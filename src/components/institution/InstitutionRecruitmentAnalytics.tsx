"use client";

type AnalyticsPayload = {
  totalCandidates: number;
  acceptanceRatePct: number;
  rejectionRatePct: number;
  interviewCount: number;
  documentsRequested: number;
  finalReportsCount: number;
};

type InstitutionRecruitmentAnalyticsProps = {
  analytics: AnalyticsPayload | null;
  isAr: boolean;
};

const InstitutionRecruitmentAnalytics = ({ analytics, isAr }: InstitutionRecruitmentAnalyticsProps) => {
  if (!analytics) return null;

  const cards = [
    { label: isAr ? "إجمالي المرشحين" : "Total candidates", value: analytics.totalCandidates },
    { label: isAr ? "نسبة القبول" : "Acceptance rate", value: `${analytics.acceptanceRatePct}%` },
    { label: isAr ? "نسبة الرفض" : "Rejection rate", value: `${analytics.rejectionRatePct}%` },
    { label: isAr ? "المقابلات" : "Interviews", value: analytics.interviewCount },
    { label: isAr ? "المستندات المطلوبة" : "Documents requested", value: analytics.documentsRequested },
    { label: isAr ? "التقارير النهائية" : "Final reports", value: analytics.finalReportsCount },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border/70 bg-white px-3 py-2 shadow-sm">
          <p className="text-[10px] font-bold text-text-light">{card.label}</p>
          <p className="text-lg font-black text-foreground">{card.value}</p>
        </div>
      ))}
    </div>
  );
};

export default InstitutionRecruitmentAnalytics;
