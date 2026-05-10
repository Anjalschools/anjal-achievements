"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export type AlumniBreadcrumbItem = { label: string; href?: string };

export type AlumniPageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  icon?: ReactNode;
  breadcrumb?: AlumniBreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
};

const AlumniPageHeader = ({
  title,
  description,
  backHref,
  backLabel,
  icon,
  breadcrumb,
  actions,
  className = "",
  dir = "rtl",
}: AlumniPageHeaderProps) => {
  const isRtl = dir === "rtl";

  return (
    <header
      dir={dir}
      className={`relative mb-8 overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-[#152a52] to-primary shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-secondary/15 blur-3xl motion-safe:animate-pulse"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -start-10 h-40 w-40 rounded-full bg-sky-400/10 blur-2xl motion-safe:animate-pulse"
        style={{ animationDelay: "0.4s" }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div className="min-w-0 flex-1 space-y-3 text-white">
          {backHref ? (
            <Link
              href={backHref}
              className={`inline-flex max-w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/15 ${
                isRtl ? "flex-row-reverse" : ""
              }`}
              tabIndex={0}
              aria-label={backLabel || (isRtl ? "رجوع" : "Back")}
            >
              <ChevronLeft
                className={`h-4 w-4 shrink-0 ${isRtl ? "rotate-180" : ""}`}
                aria-hidden
              />
              <span className="truncate">{backLabel || (isRtl ? "رجوع" : "Back")}</span>
            </Link>
          ) : null}

          {breadcrumb?.length ? (
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-sky-100/90">
              {breadcrumb.map((item, i) => (
                <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
                  {i > 0 ? <span className="text-white/40" aria-hidden>/</span> : null}
                  {item.href ? (
                    <Link href={item.href} className="hover:text-white hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-white">{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}

          <div className={`flex flex-wrap items-start gap-3 ${isRtl ? "flex-row-reverse" : ""}`}>
            {icon ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sky-100/95">{description}</p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className={`flex shrink-0 flex-wrap items-center gap-2 ${isRtl ? "sm:justify-start" : "sm:justify-end"}`}>
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default AlumniPageHeader;
