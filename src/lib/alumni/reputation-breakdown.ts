import type { AlumniReputationSnapshot } from "@/lib/alumni/reputation-graph/recompute";

export type ReputationBreakdownRow = {
  key: string;
  score: number;
  max: number;
  labelAr: string;
  labelEn: string;
  explainAr: string;
  explainEn: string;
};

const MAX_BY_KEY: Record<string, number> = {
  verification: 120,
  mentorship: 220,
  community: 120,
  events: 100,
  content: 150,
  career: 130,
  network: 100,
};

export const buildReputationBreakdown = (
  snap: Pick<
    AlumniReputationSnapshot,
    | "reputationScore"
    | "mentorshipScore"
    | "communityContributionScore"
    | "eventParticipationScore"
    | "careerImpactScore"
    | "verificationScore"
    | "networkStrengthScore"
    | "contentContributionScore"
  >
): { totalScore: number; components: ReputationBreakdownRow[] } => {
  const components: ReputationBreakdownRow[] = [
    {
      key: "verification",
      score: snap.verificationScore,
      max: MAX_BY_KEY.verification,
      labelAr: "التوثيق والثقة",
      labelEn: "Verification & trust",
      explainAr: "حسابات التحقق من الخريج، المصادر، والتمييزات الرسمية.",
      explainEn: "Verified alumni status, sources, and distinguished flags.",
    },
    {
      key: "mentorship",
      score: snap.mentorshipScore,
      max: MAX_BY_KEY.mentorship,
      labelAr: "الإرشاد",
      labelEn: "Mentorship",
      explainAr: "جلسات مكتملة أو مقبولة كمرشد أو كطالب.",
      explainEn: "Completed or accepted mentorships as mentor or mentee.",
    },
    {
      key: "community",
      score: snap.communityContributionScore,
      max: MAX_BY_KEY.community,
      labelAr: "خدمات المجتمع",
      labelEn: "Community services",
      explainAr: "تفعيل خدمات الخريج (ورش، تحكيم، تطوع…).",
      explainEn: "Alumni services toggled on (workshops, judging, volunteering…).",
    },
    {
      key: "events",
      score: snap.eventParticipationScore,
      max: MAX_BY_KEY.events,
      labelAr: "الفعاليات",
      labelEn: "Events",
      explainAr: "حضور فعاليات الخريجين (RSVP).",
      explainEn: "RSVPs for alumni events.",
    },
    {
      key: "content",
      score: snap.contentContributionScore,
      max: MAX_BY_KEY.content,
      labelAr: "المحتوى",
      labelEn: "Content",
      explainAr: "قصص منشورة وفرص معتمدة.",
      explainEn: "Published stories and approved public opportunities.",
    },
    {
      key: "career",
      score: snap.careerImpactScore,
      max: MAX_BY_KEY.career,
      labelAr: "الملف المهني",
      labelEn: "Career profile depth",
      explainAr: "اكتمال الحقول المهنية والأكاديمية في الملف.",
      explainEn: "Depth of career and academic profile fields.",
    },
    {
      key: "network",
      score: snap.networkStrengthScore,
      max: MAX_BY_KEY.network,
      labelAr: "نشاط الشبكة",
      labelEn: "Network activity",
      explainAr: "تسجيل الدخول وتحديثات الملف الزمنية.",
      explainEn: "Login recency and profile update cadence.",
    },
  ];

  return { totalScore: snap.reputationScore, components };
};
