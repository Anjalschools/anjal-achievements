import "server-only";
import connectDB from "@/lib/mongodb";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import PartnerOrganization from "@/models/PartnerOrganization";
import { buildInstitutionalSnapshot } from "@/lib/analytics/institutional-snapshot-builder";
import { reportStageLabel } from "@/lib/report-stage-mapping";
import { traceSchoolIntelligenceSection } from "@/lib/school-intelligence/school-intelligence-section-tracer";
import { confidenceFromEvidenceCount } from "@/lib/school-intelligence/school-intelligence-confidence";
import type {
  OpportunityMappingRow,
  StudentSuccessGraphNode,
} from "@/lib/school-intelligence/school-intelligence-types";

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export type OpportunityDataQualityDiagnostics = {
  invalidLabels: number;
  correctedLabels: number;
  removedEntries: number;
};

export type OpportunityMappingResult = {
  rows: OpportunityMappingRow[];
  dataQuality: OpportunityDataQualityDiagnostics;
};

const normalizeLabel = (
  raw: string,
  isAr: boolean
): { labelAr: string; labelEn: string; corrected: boolean; invalid: boolean } => {
  const value = String(raw || "").trim();
  const lower = value.toLowerCase();
  if (!value || lower === "unknown" || lower === "undefined" || lower === "null") {
    return {
      labelAr: "غير مصنف",
      labelEn: "Unclassified",
      corrected: true,
      invalid: true,
    };
  }
  if (lower.includes("unknown")) {
    return {
      labelAr: isAr ? "غير مصنف" : value.replace(/unknown/gi, "Unclassified"),
      labelEn: value.replace(/unknown/gi, "Unclassified"),
      corrected: true,
      invalid: true,
    };
  }
  return { labelAr: value, labelEn: value, corrected: false, invalid: false };
};

export const buildOpportunityMapping = async (
  nodes: StudentSuccessGraphNode[]
): Promise<OpportunityMappingResult> =>
  traceSchoolIntelligenceSection("buildOpportunityMapping", "opportunity_mapping", async () => {
  await connectDB();
  const dataQuality: OpportunityDataQualityDiagnostics = {
    invalidLabels: 0,
    correctedLabels: 0,
    removedEntries: 0,
  };

  const [snapshot, opportunities, orgs] = await Promise.all([
    traceSchoolIntelligenceSection(
      "buildInstitutionalSnapshot",
      "institutional_snapshot",
      () => buildInstitutionalSnapshot()
    ),
    TrainingOpportunity.find({ active: { $ne: false } }).select("targetGrades organizationId title").lean(),
    PartnerOrganization.find({ active: { $ne: false } }).select("name sector").lean(),
  ]);

  const rows: OpportunityMappingRow[] = [];
  const avgParticipation =
    nodes.length > 0 ? nodes.reduce((s, n) => s + n.participationCount, 0) / nodes.length : 0;

  for (const stageRow of snapshot.stageBreakdown) {
    const stageKey = String(stageRow.stage || "");
    if (!stageKey || stageKey === "unknown") {
      dataQuality.removedEntries += 1;
      continue;
    }

    const stageNodes = nodes.filter((n) => n.stage === stageRow.stage);
    const participantCount = stageNodes.reduce((s, n) => s + n.participationCount, 0);
    const benchmark = Math.max(avgParticipation * stageNodes.length, 1);
    const gapPct = clamp((1 - participantCount / benchmark) * 100);
    if (gapPct <= 15) continue;

    const labelAr = reportStageLabel(stageRow.stage as import("@/lib/report-stage-mapping").ReportStage, true);
    const labelEn = reportStageLabel(stageRow.stage as import("@/lib/report-stage-mapping").ReportStage, false);

    rows.push({
      key: `stage-${stageRow.stage}`,
      dimension: "stage",
      labelAr,
      labelEn,
      opportunityCount: opportunities.filter((o) =>
        (o.targetGrades || []).some((g) => stageNodes.some((n) => n.grade === g))
      ).length,
      participantCount,
      gapPct,
      confidence: confidenceFromEvidenceCount(2, stageNodes.length, 75),
      recommendationAr: "توسيع فرص المسابقات والتدريب لهذه المرحلة",
      recommendationEn: "Expand competitions and training for this stage",
    });
  }

  for (const track of ["arabic", "international"] as const) {
    const trackNodes = nodes.filter((n) => n.track === track);
    if (trackNodes.length === 0) continue;
    const avgPart = trackNodes.reduce((s, n) => s + n.participationCount, 0) / trackNodes.length;
    const schoolAvg = avgParticipation;
    const gapPct = schoolAvg > 0 ? clamp((1 - avgPart / schoolAvg) * 100) : 0;
    if (Math.abs(gapPct) <= 10) continue;

    rows.push({
      key: `track-${track}`,
      dimension: "track",
      labelAr: track === "arabic" ? "المسار العربي" : "المسار الدولي",
      labelEn: track === "arabic" ? "Arabic track" : "International track",
      opportunityCount: opportunities.length,
      participantCount: Math.round(avgPart * trackNodes.length),
      gapPct: Math.max(0, gapPct),
      confidence: confidenceFromEvidenceCount(2, trackNodes.length, 78),
      recommendationAr: "موازنة الفرص بين المسارات",
      recommendationEn: "Balance opportunities across tracks",
    });
  }

  for (const activity of snapshot.activityBreakdown.filter((a) => a.currentYear < a.previousYear * 0.7).slice(0, 8)) {
    const rawKey = String(activity.activityKey || "");
    const label = normalizeLabel(activity.activityLabelAr || rawKey, true);
    if (label.invalid) dataQuality.invalidLabels += 1;
    if (label.corrected) dataQuality.correctedLabels += 1;
    if (label.invalid && activity.currentYear <= 0) {
      dataQuality.removedEntries += 1;
      continue;
    }

    rows.push({
      key: `activity-${rawKey || "unclassified"}`,
      dimension: "activity",
      labelAr: label.labelAr,
      labelEn: activity.activityLabelAr || label.labelEn,
      opportunityCount: 0,
      participantCount: activity.currentYear,
      gapPct: activity.previousYear > 0 ? clamp((1 - activity.currentYear / activity.previousYear) * 100) : 0,
      confidence: confidenceFromEvidenceCount(1, activity.currentYear, 70),
      recommendationAr: `إعادة تفعيل مشاركة ${label.labelAr}`,
      recommendationEn: `Re-engage participation in ${label.labelEn}`,
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
    const orgLabel = normalizeLabel(String(org.name || ""), true);
    if (orgLabel.invalid) dataQuality.invalidLabels += 1;
    if (orgLabel.corrected) dataQuality.correctedLabels += 1;

    rows.push({
      key: `org-${org._id}`,
      dimension: "institution",
      labelAr: orgLabel.labelAr,
      labelEn: orgLabel.labelEn,
      opportunityCount: oppCount,
      participantCount: orgParticipation.get("training") || 0,
      gapPct: oppCount > 5 ? 0 : 30,
      confidence: confidenceFromEvidenceCount(2, oppCount, 72),
      recommendationAr: "ربط المؤسسة بمراحل ذات فجوة مشاركة",
      recommendationEn: "Link institution to stages with participation gaps",
    });
  }

  return {
    rows: rows.sort((a, b) => b.gapPct - a.gapPct).slice(0, 25),
    dataQuality,
  };
});
