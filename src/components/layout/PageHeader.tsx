import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  /** stacked: title full-width, actions below (default when actions exist) */
  layout?: "stacked" | "inline";
};

const PageHeader = ({
  title,
  subtitle,
  actions,
  className = "",
  layout,
}: PageHeaderProps) => {
  const useStacked = layout === "stacked" || (layout !== "inline" && Boolean(actions));

  if (useStacked) {
    return (
      <div className={`mb-5 space-y-4 sm:mb-6 ${className}`}>
        <div className="min-w-0 w-full max-w-none">
          <h1 className="text-balance text-2xl font-bold leading-tight text-text sm:text-3xl lg:text-[2rem] lg:leading-snug">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-4xl text-base leading-relaxed text-text-light sm:text-lg">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-4 sm:gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 w-full flex-1 sm:max-w-[min(100%,48rem)]">
          <h1 className="text-balance text-3xl font-bold text-text sm:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-base text-text-light sm:text-lg">{subtitle}</p>
          )}
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-3 sm:w-auto">{actions}</div>
        ) : null}
      </div>
    </div>
  );
};

export default PageHeader;
