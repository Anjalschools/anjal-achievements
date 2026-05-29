"use client";

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { buildTrainingFunnel } from "@/lib/analytics/educational-funnel-intelligence";
import EducationalFunnelChart from "@/components/analytics/funnels/EducationalFunnelChart";

export type TrainingConversionFunnelProps = {
  data: ParticipationAnalyticsPayload;
  isAr: boolean;
};

const TrainingConversionFunnel = ({ data, isAr }: TrainingConversionFunnelProps) => {
  const model = buildTrainingFunnel(data);
  return <EducationalFunnelChart model={model} isAr={isAr} />;
};

export default TrainingConversionFunnel;
