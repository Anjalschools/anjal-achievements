"use client";

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import HallOfFameIntelligence, {
  type HallOfFameIntelligenceProps,
} from "@/components/analytics/HallOfFameIntelligence";

export type StudentAchievementIntelligenceCardsProps = Omit<
  HallOfFameIntelligenceProps,
  "generalData"
> & {
  generalData?: ParticipationAnalyticsPayload | null;
};

/** Backward-compatible alias — renders Hall of Fame intelligence showcase. */
const StudentAchievementIntelligenceCards = ({
  generalData = null,
  ...rest
}: StudentAchievementIntelligenceCardsProps) => (
  <HallOfFameIntelligence generalData={generalData} {...rest} />
);

export default StudentAchievementIntelligenceCards;
