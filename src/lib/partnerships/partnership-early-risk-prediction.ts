import type { PartnershipEarlyRiskFlag } from "@/lib/partnerships/partnership-recommendation-constants";

export type EarlyRiskPredictionInput = {
  applicationStatus?: string;
  organizationQualityIndex?: number;
  partnerReliabilityIndex?: number;
  matchScore?: number;
  messageCount?: number;
  daysSinceAccepted?: number;
  parentConsentComplete?: boolean;
  documentsComplete?: boolean;
};

export type EarlyRiskPrediction = {
  riskFlags: PartnershipEarlyRiskFlag[];
  warningsAr: string[];
  warningsEn: string[];
};

export const predictPartnershipEarlyRisk = (
  input: EarlyRiskPredictionInput
): EarlyRiskPrediction => {
  const riskFlags: PartnershipEarlyRiskFlag[] = [];
  const warningsAr: string[] = [];
  const warningsEn: string[] = [];

  const status = String(input.applicationStatus || "");
  const inProgress = ["accepted", "awaiting_school_approval", "in_training"].includes(status);
  if (!inProgress) {
    return { riskFlags, warningsAr, warningsEn };
  }

  if (
    (input.organizationQualityIndex ?? 100) < 55 ||
    (input.matchScore ?? 100) < 50 ||
    (input.partnerReliabilityIndex ?? 100) < 50
  ) {
    riskFlags.push("LOW_SUCCESS_RISK");
    warningsAr.push("احتمال نجاح منخفض بناءً على بيانات الشراكات السابقة.");
    warningsEn.push("Low success likelihood based on historical partnership data.");
  }

  if ((input.messageCount ?? 0) < 1 && (input.daysSinceAccepted ?? 0) > 10) {
    riskFlags.push("LOW_ENGAGEMENT_RISK");
    warningsAr.push("ضعف التفاعل مع المؤسسة بعد القبول.");
    warningsEn.push("Low engagement with the institution after acceptance.");
  }

  if (input.parentConsentComplete === false || input.documentsComplete === false) {
    riskFlags.push("DOCUMENT_COMPLETION_RISK");
    warningsAr.push("مخاطر إكمال المستندات قبل انتهاء التدريب.");
    warningsEn.push("Document completion risk before training ends.");
  }

  return {
    riskFlags: [...new Set(riskFlags)],
    warningsAr,
    warningsEn,
  };
};
