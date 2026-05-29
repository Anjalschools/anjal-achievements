"use client";

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { buildTalentFunnel } from "@/lib/analytics/educational-funnel-intelligence";
import EducationalFunnelChart from "@/components/analytics/funnels/EducationalFunnelChart";

export type TalentProgressionFunnelProps = {
  data: ParticipationAnalyticsPayload;
  isAr: boolean;
};

const TalentProgressionFunnel = ({ data, isAr }: TalentProgressionFunnelProps) => {
  const model = buildTalentFunnel(data);
  return <EducationalFunnelChart model={model} isAr={isAr} />;
};

export default TalentProgressionFunnel;
