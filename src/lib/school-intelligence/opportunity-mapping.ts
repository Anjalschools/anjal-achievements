import "server-only";
import connectDB from "@/lib/mongodb";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import PartnerOrganization from "@/models/PartnerOrganization";
import { buildInstitutionalSnapshot } from "@/lib/analytics/institutional-snapshot-builder";
import type {
  OpportunityMappingRow,
  StudentSuccessGraphNode,
} from "@/lib/school-intelligence/school-intelligence-types";

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export const buildOpportunityMapping = async (
  nodes: StudentSuccessGraphNode[]
): Promise<OpportunityMappingRow[]> => {
  await connectDB();
  const [snapshot, opportunities, orgs] = await Promise.all([
    buildInstitutionalSnapshot(),
    TrainingOpportunity.find({ active: { $ne: false } }).select("targetGrades organizationId title").lean(),
    PartnerOrganization.find({ active: { $ne: false } }).select("name sector").lean(),
  ]);

  const rows: OpportunityMappingRow[] = [];
  const avgParticipation =
    nodes.length > 0 ? nodes.reduce((s, n) => s + n.participationCount, 0) / nodes.length : 0;

  for (const stageRow of snapshot.stageBreakdown) {
    const stageNodes = nodes.filter((n) => n.stage === stageRow.stage);
    const participantCount = stageNodes.reduce((s, n) => s + n.participationCount, 0);
    const benchmark = Math.max(avgParticipation * stageNodes.length, 1);
    const gapPct = clamp((1 - participantCount / benchmark) * 100);
    if (gapPct > 15) {
      rows.push({
        key: `stage-${stageRow.stage}`,
        dimension: "stage",
        labelAr: `مرحلة ${stageRow.stage}`,
        labelEn: `${stageRow.stage} stage`,
        opportunityCount: opportunities.filter((o) =>
          (o.targetGrades || []).some((g) => stageNodes.some((n) => n.grade === g))
        ).length,
        participantCount,
        gapPct,
        recommendationAr: "توسيع فرص المسابقات والتدريب لهذه المرحلة",
        recommendationEn: "Expand competitions and training for this stage",
      });
    }
  }

  for (const track of ["arabic", "international"] as const) {
    const trackNodes = nodes.filter((n) => n.track === track);
    if (trackNodes.length === 0) continue;
    const avgPart = trackNodes.reduce((s, n) => s + n.participationCount, 0) / trackNodes.length;
    const schoolAvg = avgParticipation;
    const gapPct = schoolAvg > 0 ? clamp((1 - avgPart / schoolAvg) * 100) : 0;
    if (Math.abs(gapPct) > 10) {
      rows.push({
        key: `track-${track}`,
        dimension: "track",
        labelAr: track === "arabic" ? "المسار العربي" : "المسار الدولي",
        labelEn: track === "arabic" ? "Arabic track" : "International track",
        opportunityCount: opportunities.length,
        participantCount: Math.round(avgPart * trackNodes.length),
        gapPct: Math.max(0, gapPct),
        recommendationAr: "موازنة الفرص بين المسارات",
        recommendationEn: "Balance opportunities across tracks",
      });
    }
  }

  for (const activity of snapshot.activityBreakdown.filter((a) => a.currentYear < a.previousYear * 0.7).slice(0, 8)) {
    rows.push({
      key: `activity-${activity.activityKey}`,
      dimension: "activity",
      labelAr: activity.activityLabelAr,
      labelEn: activity.activityKey,
      opportunityCount: 0,
      participantCount: activity.currentYear,
      gapPct: activity.previousYear > 0 ? clamp((1 - activity.currentYear / activity.previousYear) * 100) : 0,
      recommendationAr: `إعادة تفعيل مشاركة ${activity.activityLabelAr}`,
      recommendationEn: `Re-engage participation in ${activity.activityKey}`,
    });
  }

  const orgParticipation = new Map<string, number>();
  for (const node of nodes) {
    if (node.trainingHours > 0) {
      orgParticipation.set("training", (orgParticipation.get("training") || 0) + 1);
    }
  }

  for (const org of orgs.slice(0, 10)) {
    const oppCount = opportunities.filter((o) => String(o.organizationId) === String(org._id)).length;
    if (oppCount === 0) continue;
    rows.push({
      key: `org-${org._id}`,
      dimension: "institution",
      labelAr: String(org.name),
      labelEn: String(org.name),
      opportunityCount: oppCount,
      participantCount: orgParticipation.get("training") || 0,
      gapPct: oppCount > 5 ? 0 : 30,
      recommendationAr: "ربط المؤسسة بمراحل ذات فجوة مشاركة",
      recommendationEn: "Link institution to stages with participation gaps",
    });
  }

  return rows.sort((a, b) => b.gapPct - a.gapPct).slice(0, 25);
};
