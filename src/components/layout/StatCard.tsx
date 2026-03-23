import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  className = "",
}: StatCardProps) => {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-text-light">{title}</p>
          <p className="mt-2 text-3xl font-bold text-text">{value}</p>
          {trend && (
            <p
              className={`mt-2 text-sm font-medium ${
                trend.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {trend.value}
            </p>
          )}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
