import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

const PageHeader = ({
  title,
  subtitle,
  actions,
  className = "",
}: PageHeaderProps) => {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-text sm:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-base text-text-light sm:text-lg">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
