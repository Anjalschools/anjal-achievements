"use client";

import { Award, Flag, Globe, MapPin, School } from "lucide-react";
import type { HallAchievementCard } from "@/lib/hall-of-fame-service";
import { hallTierAchievementCardClass } from "@/lib/hall-of-fame-level";

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
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-base font-bold leading-snug text-text">{card.title}</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-text-light">
                {card.categoryLabel}
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                {card.levelLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-text-light">
                {card.participationLabel}
              </span>
            </div>
            <p className="text-sm font-semibold text-text">{card.resultLine}</p>
            <div className="flex flex-wrap gap-3 text-xs text-text-light">
              <span>
                {isAr ? "السنة" : "Year"}: <span className="font-semibold text-text">{card.year}</span>
              </span>
              <span>
                {isAr ? "التاريخ" : "Date"}: <span className="font-semibold text-text">{card.dateLabel}</span>
              </span>
            </div>
            {card.description ? (
              <p className="text-sm leading-relaxed text-text-light line-clamp-4">{card.description}</p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
};

export default StudentHallAchievementCard;
