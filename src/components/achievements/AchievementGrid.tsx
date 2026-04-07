import AchievementCard from "./AchievementCard";
import EmptyState from "@/components/layout/EmptyState";
import { Trophy } from "lucide-react";
import { getLocale } from "@/lib/i18n";

type Achievement = {
  id: string;
  title: string;
  titleAr?: string;
  nameAr?: string;
  nameEn?: string;
  achievementName?: string;
  customAchievementName?: string;
  description: string;
  category: string;
  achievementType?: string;
  achievementLevel?: string;
  score?: number;
  scoreBreakdown?: unknown;
  resultType?: string;
  resultValue?: string;
  medalType?: string;
  rank?: string;
  inferredField?: string;
  participationType?: string;
  achievementYear?: number | null;
  date: string;
  image?: string;
  featured?: boolean;
  approved?: boolean;
  status?: string;
  isFeatured?: boolean;
  approvalStatus?: string;
  pendingReReview?: boolean;
};

type AchievementGridProps = {
  achievements: Achievement[];
  onDelete?: (id: string) => void;
  className?: string;
};

const AchievementGrid = ({
  achievements,
  onDelete,
  className = "",
}: AchievementGridProps) => {
  const locale = getLocale();

  if (achievements.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={
          locale === "ar"
            ? "لا توجد إنجازات"
            : "No achievements found"
        }
        description={
          locale === "ar"
            ? "جرب البحث بكلمات مختلفة أو تصفية أخرى"
            : "Try searching with different keywords or filters"
        }
      />
    );
  }

  return (
    <div
      className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {achievements.map((achievement, index) => (
        <AchievementCard
          key={achievement.id ? achievement.id : `achievement-${index}`}
          {...achievement}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default AchievementGrid;
