"use client";

import { Award, Flag, Globe, MapPin, School } from "lucide-react";
import type { HallAchievementCard } from "@/lib/hall-of-fame-service";
import { hallTierAchievementCardClass } from "@/lib/hall-of-fame-level";
import StudentAchievementDataRows from "@/components/achievements/StudentAchievementDataRows";

type Props = {
  card: HallAchievementCard;
  isAr: boolean;
};

const iconFor = (tier: HallAchievementCard["levelTier"]) => {
  switch (tier) {
    case "international":
      return Globe;
    case "national":
      return Flag;
    case "regional":
      return MapPin;
    case "school":
      return School;
    default:
      return Award;
  }
};

const StudentHallAchievementCard = ({ card, isAr }: Props) => {
  const Icon = iconFor(card.levelTier);
  const { bar, icon } = hallTierAchievementCardClass(card.levelTier);
  const locale = isAr ? "ar" : "en";

  const rowLabels = isAr
    ? {
        type: "الإنجاز",
        resultType: "النتيجة",
        outcome: "المحقق",
        participation: "نوع المشاركة",
      }
    : {
        type: "Achievement",
        resultType: "Result",
        outcome: "Merit",
        participation: "Participation type",
      };

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-md transition hover:shadow-lg">
      <div className={`h-1.5 w-full bg-gradient-to-l ${bar}`} />
      <div className="p-5">
        <div className="flex gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${bar} shadow-inner`}
          >
            <Icon className={`h-6 w-6 ${icon}`} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <h3 className="line-clamp-2 min-w-0 text-base font-bold leading-snug text-text" title={card.title}>
              {card.title}
            </h3>
            <StudentAchievementDataRows
              locale={locale}
              content={card.summary}
              levelKey={card.levelBadgeKey}
              medalType={card.medalType}
              resultType={card.resultType}
              compact={false}
              showLevelMedalBadges
              rowLabels={rowLabels}
            />
            <footer className="border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-text-light">
              <span className="font-semibold text-text-muted">{isAr ? "التاريخ" : "Date"}:</span>{" "}
              <span className="font-medium text-text">{card.dateLabel}</span>
            </footer>
          </div>
        </div>
      </div>
    </article>
  );
};

export default StudentHallAchievementCard;
