"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type AlumniEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  className?: string;
  dir?: "rtl" | "ltr";
};

const AlumniEmptyState = ({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
  className = "",
  dir = "rtl",
}: AlumniEmptyStateProps) => {
  const isRtl = dir === "rtl";

  return (
    <div
      dir={dir}
      className={`relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-sky-50/80 px-6 py-14 text-center shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] ${className}`}
      role="status"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(30,58,138,0.08),_transparent_55%)] motion-safe:animate-pulse"
        aria-hidden
      />
      <div className={`relative mx-auto flex max-w-md flex-col items-center gap-4 ${isRtl ? "" : ""}`}>
        {icon ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 motion-safe:transition motion-safe:duration-500 motion-safe:hover:scale-[1.03]">
            {icon}
          </div>
        ) : null}
        <div>
          <p className="text-lg font-black text-slate-900">{title}</p>
          {description ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p> : null}
        </div>
        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition hover:opacity-95"
            tabIndex={0}
          >
            {ctaLabel}
          </Link>
        ) : null}
        {ctaLabel && onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition hover:opacity-95"
            tabIndex={0}
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default AlumniEmptyState;
