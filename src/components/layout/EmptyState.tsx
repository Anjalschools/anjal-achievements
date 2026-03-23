import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-text">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-text-light">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
