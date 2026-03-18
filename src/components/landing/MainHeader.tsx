"use client";

import Image from "next/image";
import Link from "next/link";
import { platformName } from "@/data/landing-content";

const MainHeader = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[84px] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90"
            aria-label="العودة إلى الصفحة الرئيسية"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
              <Image
                src="/logow.png"
                alt="شعار مدارس الأنجال الأهلية"
                fill
                priority
                className="object-contain p-1"
                sizes="48px"
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight text-primary sm:text-xl">
                {platformName.ar}
              </h1>
              <p className="truncate text-[11px] leading-tight text-text-light sm:text-xs">
                {platformName.tagline}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex xl:gap-7">
            <Link
              href="/achievements"
              className="whitespace-nowrap text-sm font-medium text-text transition-colors hover:text-primary"
            >
              الإنجازات
            </Link>

            <Link
              href="/rankings"
              className="whitespace-nowrap text-sm font-medium text-text transition-colors hover:text-primary"
            >
              التصنيفات
            </Link>

            <Link
              href="/hall-of-fame"
              className="whitespace-nowrap text-sm font-medium text-text transition-colors hover:text-primary"
            >
              Hall of Fame
            </Link>

            <Link
              href="/categories"
              className="whitespace-nowrap text-sm font-medium text-text transition-colors hover:text-primary"
            >
              المجالات
            </Link>
          </nav>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative hidden xl:block">
              <input
                type="text"
                placeholder="ابحث عن إنجاز أو طالب..."
                className="h-11 w-64 rounded-xl border border-gray-300 bg-white pr-10 pl-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <Link
              href="/login"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-text transition-colors hover:text-primary sm:px-4"
            >
              تسجيل الدخول
            </Link>

            <Link
              href="/register"
              className="whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark sm:px-5"
            >
              انضم الآن
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
