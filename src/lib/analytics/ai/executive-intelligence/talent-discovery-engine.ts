/**
 * talent-discovery-engine.ts
 * Identifies early-talent students from longitudinal profiles.
 */

import type { ExecutiveInsight, InstitutionalSnapshot } from "./executive-insight-types";
import type { StudentSample } from "./executive-insight-types";

const TALENT_MIN_QUALITY   = 65;
const MOMENTUM_ACCELERATING = new Set(["accelerating"]);

export const detectEarlyTalents = (
  snapshot: InstitutionalSnapshot
): ExecutiveInsight[] => {
  const insights: ExecutiveInsight[] = [];
  const now = new Date().toISOString();
  const samples = snapshot.studentSamples ?? [];

  const talents = samples.filter(
    (s) =>
      MOMENTUM_ACCELERATING.has(s.recentTrend) ||
      (s.momentum === "high" && s.peakQuality >= TALENT_MIN_QUALITY) ||
      s.olympiadTrajectory === "strong"
  );

  for (const t of talents) {
    const isOlympiad = t.olympiadTrajectory === "strong";
    insights.push({
      id: `talent-${t.userId}-${Math.random().toString(36).slice(2,8)}`,
      insightType: "talent_detection",
      severity: isOlympiad ? "high" : "medium",
      title: `موهبة ${isOlympiad ? "أولمبية " : ""}صاعدة — ${t.displayName}`,
      titleEn: `Emerging ${isOlympiad ? "olympiad " : ""}talent — ${t.displayName}`,
      body: `يُظهر الطالب اتجاهاً متسارعاً في الأداء (جودة: ${Math.round(t.recentQuality)}/100) مع زخم عالٍ ومسار أولمبي ${t.olympiadTrajectory}.`,
      evidence: [
        { label: "الاتجاه", value: t.recentTrend },
        { label: "الزخم", value: t.momentum },
        { label: "أعلى جودة", value: t.peakQuality },
        { label: "الجودة الأخيرة", value: Math.round(t.recentQuality) },
        { label: "المسار الأولمبي", value: t.olympiadTrajectory },
      ],
      recommendation: isOlympiad
        ? `ترشيح الطالب فوراً لمسار الأولمبياد وتوفير تدريب متخصص.`
        : `متابعة مسيرة الطالب وتوجيهه نحو برامج الموهوبين والمسابقات المتقدمة.`,
      recommendationEn: isOlympiad
        ? `Nominate student for olympiad track with dedicated training.`
        : `Track student and guide toward gifted programs and advanced competitions.`,
      affectedEntity: t.userId,
      affectedEntityType: "student",
      domain: isOlympiad ? "olympiad" : "stem",
      confidence: t.momentum === "high" ? "HIGH" : "MEDIUM",
      generatedAt: now,
      metadata: { userId: t.userId, trend: t.recentTrend, olympiadTrajectory: t.olympiadTrajectory },
    });
  }

  return insights;
};
