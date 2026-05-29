"use client";

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { buildCompetitionFunnel } from "@/lib/analytics/educational-funnel-intelligence";
import EducationalFunnelChart from "@/components/analytics/funnels/EducationalFunnelChart";

export type OlympiadPipelineFunnelProps = {
  data: ParticipationAnalyticsPayload;
  isAr: boolean;
};

/** Competition / olympiad pipeline (participation → medal). */
const OlympiadPipelineFunnel = ({ data, isAr }: OlympiadPipelineFunnelProps) => {
  const model = buildCompetitionFunnel(data);
  return <EducationalFunnelChart model={model} isAr={isAr} />;
};

export default OlympiadPipelineFunnel;
