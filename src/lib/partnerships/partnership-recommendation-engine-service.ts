import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import {
  PARTNERSHIP_CATEGORY_RANKING_GROUPS,
  trainingOutcomeLabel,
  type PartnershipCategoryRankingGroupKey,
} from "@/lib/partnerships/partnership-recommendation-constants";
import { predictPartnershipEarlyRisk } from "@/lib/partnerships/partnership-early-risk-prediction";
import { computePartnerReliabilityIndex } from "@/lib/partnerships/partner-reliability-index";
import type {
  AnnualPartnershipReport,
  PartnerOrganizationRecommendationProfile,
  PartnershipCategoryRanking,
  PartnershipExecutiveIntelligence,
  StudentTrainingRecommendationPayload,
} from "@/lib/partnerships/partnership-recommendation-types";
import {
  computeTrainingOutcomeIntelligence,
} from "@/lib/partnerships/training-outcome-intelligence";
import { analyzeTrainingReportConsistency } from "@/lib/partnerships/training-report-consistency";
import {
  computeOrganizationTrainingQualityIndex,
  type OrganizationQualityRecordInput,
} from "@/lib/partnerships/training-organization-quality-index";
import {
  rankOpportunityMatches,
  type StudentMatchProfile,
} from "@/lib/partnerships/training-opportunity-matching";

export type {
  AnnualPartnershipReport,
  PartnershipExecutiveIntelligence,
  StudentTrainingRecommendationPayload,
} from "@/lib/partnerships/partnership-recommendation-types";

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const round1 = (value: number) => Math.round(value * 10) / 10;

const orgMatchesRankingGroup = (
  org: { category?: string; sector?: string; name?: string },
  groupKey: PartnershipCategoryRankingGroupKey
) => {
  const group = PARTNERSHIP_CATEGORY_RANKING_GROUPS[groupKey];
  if (org.category && (group.categories as readonly string[]).includes(org.category)) return true;
  const text = `${org.sector || ""} ${org.name || ""}`.toLowerCase();
  return group.sectorHints.some((hint) => text.includes(hint.toLowerCase()));
};

const responseDays = (submittedAt?: Date | null, reviewedAt?: Date | null) => {
  if (!submittedAt || !reviewedAt) return null;
  const diff = reviewedAt.getTime() - submittedAt.getTime();
  if (diff < 0) return null;
  return round1(diff / (1000 * 60 * 60 * 24));
};

export const buildStudentMatchProfile = async (studentId: string): Promise<StudentMatchProfile> => {
  await connectDB();
  const [careerProfile, user, completionRecords, achievements] = await Promise.all([
    StudentCareerProfile.findOne({ studentId: new mongoose.Types.ObjectId(studentId) })
      .select("careerInterests targetMajors")
      .lean(),
    User.findById(studentId).select("grade section").lean(),
    TrainingCompletionRecord.find({ studentId: new mongoose.Types.ObjectId(studentId) })
      .select("organizationId")
      .lean(),
    Achievement.find({
      userId: new mongoose.Types.ObjectId(studentId),
      $or: [{ status: "approved" }, { approved: true }],
      status: { $ne: "rejected" },
    })
      .select("achievementLevel level achievementType achievementName resultType")
      .limit(30)
      .lean(),
  ]);

  const orgIds = [...new Set(completionRecords.map((row) => String(row.organizationId)).filter(Boolean))];
  const orgs =
    orgIds.length > 0
      ? await PartnerOrganization.find({ _id: { $in: orgIds } }).select("category").lean()
      : [];
  const priorTrainingCategories = orgs
    .map((org) => String(org.category || ""))
    .filter(Boolean);

  const achievementCategories = achievements.flatMap((row) =>
    [row.achievementLevel, row.level, row.achievementType, row.resultType]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );

  return {
    careerInterests: careerProfile?.careerInterests || [],
    targetMajors: careerProfile?.targetMajors || [],
    achievementCategories: [...new Set(achievementCategories)],
    priorTrainingCategories: [...new Set(priorTrainingCategories)],
    grade: user?.grade ? String(user.grade) : undefined,
    section: user?.section ? String(user.section) : undefined,
  };
};

type OrgAggregate = {
  organizationId: string;
  organizationName: string;
  category?: string;
  sector?: string;
  city?: string;
  records: OrganizationQualityRecordInput[];
  applications: Array<{
    status: string;
    submittedAt?: Date;
    reviewedAt?: Date;
    parentConsentComplete?: boolean;
    documentsComplete?: boolean;
  }>;
  applicantCount: number;
};

const buildOrganizationAggregates = async (): Promise<OrgAggregate[]> => {
  await connectDB();
  const [records, applications, opportunities, organizations] = await Promise.all([
    TrainingCompletionRecord.find({}).lean(),
    StudentTrainingApplication.find({ archived: { $ne: true } })
      .select("status submittedAt reviewedAt opportunityId studentSnapshot")
      .lean(),
    TrainingOpportunity.find({}).select("_id organizationId title").lean(),
    PartnerOrganization.find({ active: { $ne: false } }).select("name category sector city").lean(),
  ]);

  const oppOrgMap = new Map(
    opportunities.map((row) => [String(row._id), String(row.organizationId || "")])
  );
  const orgMeta = new Map(
    organizations.map((org) => [
      String(org._id),
      {
        organizationName: org.name || "",
        category: org.category ? String(org.category) : undefined,
        sector: org.sector ? String(org.sector) : undefined,
        city: org.city ? String(org.city) : undefined,
      },
    ])
  );

  const byOrg = new Map<string, OrgAggregate>();

  const ensureOrg = (organizationId: string) => {
    const meta = orgMeta.get(organizationId);
    const existing = byOrg.get(organizationId);
    if (existing) return existing;
    const created: OrgAggregate = {
      organizationId,
      organizationName: meta?.organizationName || organizationId,
      category: meta?.category,
      sector: meta?.sector,
      city: meta?.city,
      records: [],
      applications: [],
      applicantCount: 0,
    };
    byOrg.set(organizationId, created);
    return created;
  };

  for (const record of records) {
    const organizationId = String(record.organizationId || "");
    if (!organizationId) continue;
    const bucket = ensureOrg(organizationId);
    bucket.records.push(record as OrganizationQualityRecordInput);
  }

  for (const app of applications) {
    const organizationId = oppOrgMap.get(String(app.opportunityId)) || "";
    if (!organizationId) continue;
    const bucket = ensureOrg(organizationId);
    bucket.applicantCount += 1;
    bucket.applications.push({
      status: String(app.status || ""),
      submittedAt: app.submittedAt,
      reviewedAt: app.reviewedAt,
      parentConsentComplete: undefined,
      documentsComplete: undefined,
    });
  }

  return [...byOrg.values()];
};

export const buildPartnerOrganizationProfile = (
  aggregate: OrgAggregate
): PartnerOrganizationRecommendationProfile => {
  const quality = computeOrganizationTrainingQualityIndex(aggregate.records);
  const responseDaysList = aggregate.applications
    .map((app) => responseDays(app.submittedAt, app.reviewedAt))
    .filter((value): value is number => typeof value === "number");
  const averageResponseDays = responseDaysList.length
    ? round1(responseDaysList.reduce((sum, value) => sum + value, 0) / responseDaysList.length)
    : 0;

  const completedApps = aggregate.applications.filter((app) =>
    ["approved", "in_training", "completed"].includes(app.status)
  ).length;
  const approvedApps = aggregate.applications.filter((app) => app.status === "approved").length;
  const reportCompletionRatePct = pct(quality.reportCount, Math.max(completedApps, 1));
  const approvalCompletionRatePct = pct(approvedApps, aggregate.applicantCount);
  const supervisorApprovalRatePct = quality.approvalRatePct;

  const reliability = computePartnerReliabilityIndex({
    reportCompletionRatePct,
    averageResponseDays,
    approvalCompletionRatePct,
    studentRecommendationRatePct: quality.recommendationRatePct,
    supervisorApprovalRatePct,
  });

  const combinedScore = Math.round(
    quality.organizationTrainingQualityIndex * 0.55 + reliability.partnerReliabilityIndex * 0.45
  );

  return {
    organizationId: aggregate.organizationId,
    organizationName: aggregate.organizationName,
    category: aggregate.category,
    sector: aggregate.sector,
    city: aggregate.city,
    partnerReliabilityIndex: reliability.partnerReliabilityIndex,
    organizationTrainingQualityIndex: quality.organizationTrainingQualityIndex,
    combinedScore,
    applicantCount: aggregate.applicantCount,
    averageStudentSatisfaction: quality.averageStudentSatisfaction,
    recommendationRatePct: quality.recommendationRatePct,
    reportCompletionRatePct,
    averageResponseDays,
  };
};

export const buildAllPartnerOrganizationProfiles = async () => {
  const aggregates = await buildOrganizationAggregates();
  return aggregates.map(buildPartnerOrganizationProfile);
};

export const buildPartnershipCategoryRankings = async (): Promise<PartnershipCategoryRanking[]> => {
  const profiles = await buildAllPartnerOrganizationProfiles();
  const groupKeys = Object.keys(PARTNERSHIP_CATEGORY_RANKING_GROUPS) as PartnershipCategoryRankingGroupKey[];

  return groupKeys.map((groupKey) => {
    const group = PARTNERSHIP_CATEGORY_RANKING_GROUPS[groupKey];
    const partners = profiles
      .filter((profile) =>
        orgMatchesRankingGroup(
          { category: profile.category, sector: profile.sector, name: profile.organizationName },
          groupKey
        )
      )
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 5)
      .map((profile) => ({
        organizationId: profile.organizationId,
        organizationName: profile.organizationName,
        combinedScore: profile.combinedScore,
        partnerReliabilityIndex: profile.partnerReliabilityIndex,
        organizationTrainingQualityIndex: profile.organizationTrainingQualityIndex,
      }));

    return {
      groupKey,
      labelAr: group.labelAr,
      labelEn: group.labelEn,
      partners,
    };
  });
};

export const buildPartnershipExecutiveIntelligence = async (): Promise<PartnershipExecutiveIntelligence> => {
  await connectDB();
  const [profiles, categoryRankings, opportunities, records] = await Promise.all([
    buildAllPartnerOrganizationProfiles(),
    buildPartnershipCategoryRankings(),
    TrainingOpportunity.find({ active: { $ne: false } }).select("_id title organizationId").lean(),
    TrainingCompletionRecord.find({}).lean(),
  ]);

  const orgNameMap = new Map(profiles.map((row) => [row.organizationId, row.organizationName]));

  const opportunityOutcomes = opportunities.map((opp) => {
    const organizationId = String(opp.organizationId || "");
    const orgRecords = records.filter((row) => String(row.organizationId) === organizationId);
    const consistencyScores = orgRecords.map((record) =>
      analyzeTrainingReportConsistency(record).consistencyScore
    );
    const avgConsistency = consistencyScores.length
      ? consistencyScores.reduce((sum, value) => sum + value, 0) / consistencyScores.length
      : 0;
    const quality = computeOrganizationTrainingQualityIndex(orgRecords as OrganizationQualityRecordInput[]);
    const outcome = computeTrainingOutcomeIntelligence({
      studentSatisfaction: quality.averageStudentSatisfaction,
      institutionEvaluation: quality.averageInstitutionEvaluation,
      consistencyScore: avgConsistency,
      recommendationRatePct: quality.recommendationRatePct,
    });
    return {
      opportunityId: String(opp._id),
      title: String(opp.title || ""),
      organizationName: orgNameMap.get(organizationId) || organizationId,
      successScore: outcome.outcomeScore,
      trainingOutcomeLevel: outcome.trainingOutcomeLevel,
    };
  });

  const sortedProfiles = [...profiles].sort((a, b) => b.combinedScore - a.combinedScore);

  return {
    generatedAt: new Date().toISOString(),
    bestPerformingPartners: sortedProfiles.slice(0, 8),
    decliningPartners: [...profiles]
      .filter((row) => row.averageStudentSatisfaction > 0 && row.averageStudentSatisfaction < 3.2)
      .sort((a, b) => a.combinedScore - b.combinedScore)
      .slice(0, 8),
    highDemandPartners: [...profiles]
      .sort((a, b) => b.applicantCount - a.applicantCount)
      .slice(0, 8),
    lowSatisfactionPartners: [...profiles]
      .filter((row) => row.averageStudentSatisfaction > 0)
      .sort((a, b) => a.averageStudentSatisfaction - b.averageStudentSatisfaction)
      .slice(0, 8),
    mostSuccessfulOpportunities: opportunityOutcomes
      .sort((a, b) => b.successScore - a.successScore)
      .slice(0, 8),
    categoryRankings,
  };
};

export const buildStudentTrainingRecommendations = async (
  studentId: string
): Promise<StudentTrainingRecommendationPayload> => {
  await connectDB();
  const [matchProfile, opportunities, orgProfiles, activeApplication] = await Promise.all([
    buildStudentMatchProfile(studentId),
    TrainingOpportunity.find({ visible: true, active: { $ne: false } })
      .select("_id title description organizationId")
      .lean(),
    buildAllPartnerOrganizationProfiles(),
    StudentTrainingApplication.findOne({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: { $in: ["accepted", "awaiting_school_approval", "in_training"] },
      archived: { $ne: true },
    })
      .select("_id status opportunityId submittedAt reviewedAt")
      .lean(),
  ]);

  const orgIds = [...new Set(opportunities.map((row) => String(row.organizationId)).filter(Boolean))];
  const orgDocs =
    orgIds.length > 0
      ? await PartnerOrganization.find({ _id: { $in: orgIds } })
          .select("name category sector city")
          .lean()
      : [];
  const orgDocMap = new Map(orgDocs.map((org) => [String(org._id), org]));
  const profileMap = new Map(orgProfiles.map((row) => [row.organizationId, row]));

  const targets = opportunities.map((opp) => {
    const organizationId = String(opp.organizationId || "");
    const org = orgDocMap.get(organizationId);
    const profile = profileMap.get(organizationId);
    return {
      opportunityId: String(opp._id),
      title: String(opp.title || ""),
      description: String(opp.description || ""),
      organizationId,
      organizationName: org?.name || organizationId,
      organizationCategory: org?.category ? String(org.category) : undefined,
      organizationSector: org?.sector ? String(org.sector) : undefined,
      organizationCity: org?.city ? String(org.city) : undefined,
      qualityIndex: profile?.organizationTrainingQualityIndex,
      reliabilityIndex: profile?.partnerReliabilityIndex,
    };
  });

  const ranked = rankOpportunityMatches(matchProfile, targets).slice(0, 6);
  const oppTitleMap = new Map(targets.map((row) => [row.opportunityId, row.title]));
  const oppMetaMap = new Map(
    targets.map((row) => [
      row.opportunityId,
      { organizationCity: row.organizationCity, organizationSector: row.organizationSector },
    ])
  );

  let earlyRisk: StudentTrainingRecommendationPayload["earlyRisk"] = null;
  if (activeApplication) {
    const oppId = String(activeApplication.opportunityId || "");
    const opp = opportunities.find((row) => String(row._id) === oppId);
    const organizationId = String(opp?.organizationId || "");
    const profile = profileMap.get(organizationId);
    const topMatch = ranked.find((row) => row.opportunityId === oppId);
    const daysSinceAccepted =
      activeApplication.reviewedAt instanceof Date
        ? round1((Date.now() - activeApplication.reviewedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const risk = predictPartnershipEarlyRisk({
      applicationStatus: String(activeApplication.status || ""),
      organizationQualityIndex: profile?.organizationTrainingQualityIndex,
      partnerReliabilityIndex: profile?.partnerReliabilityIndex,
      matchScore: topMatch?.trainingOpportunityMatchScore,
      messageCount: 0,
      daysSinceAccepted,
      parentConsentComplete: undefined,
      documentsComplete: undefined,
    });
    if (risk.riskFlags.length > 0) {
      earlyRisk = {
        applicationId: String(activeApplication._id),
        opportunityTitle: opp ? String(opp.title || "") : oppId,
        riskFlags: risk.riskFlags,
        warningsAr: risk.warningsAr,
        warningsEn: risk.warningsEn,
      };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    recommendations: ranked.map((row) => ({
      ...row,
      title: oppTitleMap.get(row.opportunityId) || "",
      organizationCity: oppMetaMap.get(row.opportunityId)?.organizationCity,
      organizationSector: oppMetaMap.get(row.opportunityId)?.organizationSector,
    })),
    earlyRisk,
  };
};

export const buildAnnualPartnershipReport = async (
  academicYearLabel?: string
): Promise<AnnualPartnershipReport> => {
  await connectDB();
  const yearFilter = academicYearLabel?.trim() || "";
  const recordQuery = yearFilter ? { academicYear: yearFilter } : {};
  const [records, profiles] = await Promise.all([
    TrainingCompletionRecord.find(recordQuery).lean(),
    buildAllPartnerOrganizationProfiles(),
  ]);

  const byYear = new Map<string, OrganizationQualityRecordInput[]>();
  for (const record of records) {
    const key = String(record.academicYear || "unknown");
    const bucket = byYear.get(key) || [];
    bucket.push(record as OrganizationQualityRecordInput);
    byYear.set(key, bucket);
  }

  const trendYears = [...byYear.keys()].sort();
  const studentSatisfactionTrends = trendYears.map((label) => {
    const metrics = computeOrganizationTrainingQualityIndex(byYear.get(label) || []);
    return { label, average: metrics.averageStudentSatisfaction };
  });
  const completionTrends = trendYears.map((label) => {
    const metrics = computeOrganizationTrainingQualityIndex(byYear.get(label) || []);
    return { label, ratePct: metrics.completionRatePct };
  });
  const recommendationTrends = trendYears.map((label) => {
    const metrics = computeOrganizationTrainingQualityIndex(byYear.get(label) || []);
    return { label, ratePct: metrics.recommendationRatePct };
  });

  const currentMetrics = computeOrganizationTrainingQualityIndex(records as OrganizationQualityRecordInput[]);
  const successTrends = [
    { label: "qualityIndex", value: currentMetrics.organizationTrainingQualityIndex },
    { label: "completionRatePct", value: currentMetrics.completionRatePct },
    { label: "recommendationRatePct", value: currentMetrics.recommendationRatePct },
    { label: "approvalRatePct", value: currentMetrics.approvalRatePct },
  ];

  return {
    generatedAt: new Date().toISOString(),
    academicYearLabel: yearFilter || (trendYears.at(-1) ?? "all"),
    topOrganizations: profiles
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 10)
      .map((row) => ({
        organizationName: row.organizationName,
        combinedScore: row.combinedScore,
        recommendationRatePct: row.recommendationRatePct,
      })),
    successTrends,
    studentSatisfactionTrends,
    completionTrends,
    recommendationTrends,
  };
};

export const trainingOutcomeLevelLabel = trainingOutcomeLabel;
