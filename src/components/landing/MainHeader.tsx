"use client";

import { platformName } from "@/data/landing-content";

const MainHeader = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Platform Name */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-primary leading-tight whitespace-nowrap">
                {platformName.ar}
              </h1>
              <p className="text-[10px] text-text-light leading-tight whitespace-nowrap">
                {platformName.tagline}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <a
              href="/achievements"
              className="text-sm text-text hover:text-primary transition-colors font-medium whitespace-nowrap"
            >
              الإنجازات
            </a>
            <a
              href="/rankings"
              className="text-sm text-text hover:text-primary transition-colors font-medium whitespace-nowrap"
            >
              التصنيفات
            </a>
            <a
              href="/hall-of-fame"
              className="text-sm text-text hover:text-primary transition-colors font-medium whitespace-nowrap"
            >
              Hall of Fame
            </a>
            <a
              href="/categories"
              className="text-sm text-text hover:text-primary transition-colors font-medium whitespace-nowrap"
            >
              التصنيفات
            </a>
          </nav>

          {/* Search and Actions */}
          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="hidden lg:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث عن إنجاز أو طالب..."
                  className="w-56 px-3 py-1.5 pr-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-xs"
                />
                <svg
                  className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="px-3 py-1.5 text-xs text-text hover:text-primary transition-colors font-medium whitespace-nowrap"
              >
                تسجيل الدخول
              </a>
              <a
                href="/register"
                className="px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-xs font-medium whitespace-nowrap"
              >
                انضم الآن
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
