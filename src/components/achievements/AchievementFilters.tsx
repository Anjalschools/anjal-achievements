"use client";

import { useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { getLocale } from "@/lib/i18n";

type AchievementFiltersProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType?: string;
  onTypeChange: (type: string) => void;
  selectedYear?: string;
  onYearChange: (year: string) => void;
  selectedCategory?: string;
  onCategoryChange: (category: string) => void;
  className?: string;
};

const AchievementFilters = ({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedYear,
  onYearChange,
  selectedCategory,
  onCategoryChange,
  className = "",
}: AchievementFiltersProps) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const locale = getLocale();

  const types = [
    { value: "all", label: locale === "ar" ? "الكل" : "All" },
    { value: "featured", label: locale === "ar" ? "مميز" : "Featured" },
    { value: "recent", label: locale === "ar" ? "حديث" : "Recent" },
  ];

  const years = [
    { value: "all", label: locale === "ar" ? "الكل" : "All" },
    { value: "2024", label: "2024" },
    { value: "2023", label: "2023" },
    { value: "2022", label: "2022" },
  ];

  const categories = [
    { value: "all", label: locale === "ar" ? "الكل" : "All" },
    { value: "science", label: locale === "ar" ? "العلوم" : "Science" },
    { value: "innovation", label: locale === "ar" ? "الابتكار" : "Innovation" },
    { value: "sports", label: locale === "ar" ? "الرياضة" : "Sports" },
    { value: "arts", label: locale === "ar" ? "الفنون" : "Arts" },
  ];

  const hasActiveFilters =
    selectedType !== "all" ||
    selectedYear !== "all" ||
    selectedCategory !== "all";

  const clearFilters = () => {
    onTypeChange("all");
    onYearChange("all");
    onCategoryChange("all");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
        <input
          type="text"
          placeholder={
            locale === "ar"
              ? "ابحث عن إنجاز..."
              : "Search for an achievement..."
          }
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white pr-10 pl-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-light hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          <span>{locale === "ar" ? "التصفية" : "Filters"}</span>
          {hasActiveFilters && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
              {locale === "ar" ? "نشط" : "Active"}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-primary hover:text-primary-dark"
          >
            {locale === "ar" ? "مسح التصفية" : "Clear Filters"}
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {isFiltersOpen && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Type Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                {locale === "ar" ? "النوع" : "Type"}
              </label>
              <select
                value={selectedType || "all"}
                onChange={(e) => onTypeChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                {locale === "ar" ? "السنة" : "Year"}
              </label>
              <select
                value={selectedYear || "all"}
                onChange={(e) => onYearChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {years.map((year) => (
                  <option key={year.value} value={year.value}>
                    {year.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                {locale === "ar" ? "الفئة" : "Category"}
              </label>
              <select
                value={selectedCategory || "all"}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementFilters;
