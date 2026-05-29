"use client";

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { buildStandardizedTestingFunnel } from "@/lib/analytics/educational-funnel-intelligence";
import EducationalFunnelChart from "@/components/analytics/funnels/EducationalFunnelChart";

export type StandardizedTestingFunnelProps = {
  data: ParticipationAnalyticsPayload;
  isAr: boolean;
};

const StandardizedTestingFunnel = ({ data, isAr }: StandardizedTestingFunnelProps) => {
  const model = buildStandardizedTestingFunnel(data);
  return <EducationalFunnelChart model={model} isAr={isAr} />;
};

export default StandardizedTestingFunnel;
