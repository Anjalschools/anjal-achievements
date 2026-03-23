"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import AchievementGrid from "@/components/achievements/AchievementGrid";
import AchievementFilters from "@/components/achievements/AchievementFilters";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import { safeString, safeTrim } from "@/lib/achievementDisplay";

const AchievementsPage = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [achievements, setAchievements] = useState<any[]>([]);
  const [filteredAchievements, setFilteredAchievements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /** Blocks window `focus` refresh while delete/confirm runs (closing confirm triggers focus). */
  const deleteFlowActiveRef = useRef(false);

  const locale = getLocale();
  const t = getTranslation(locale);

  const fetchAchievements = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/achievements", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        setAchievements(list);
        setFilteredAchievements(list);
      }
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Fetch real data from API
  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  // Refresh when page gains focus (user returns from creating achievement)
  useEffect(() => {
    const handleFocus = () => {
      if (deleteFlowActiveRef.current) return;
      router.refresh();
      fetchAchievements();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [router, fetchAchievements]);

  const handleDeleteAchievement = async (id: string) => {
    if (deleteFlowActiveRef.current) return;

    const normalizedId = String(id ?? "").trim();
    if (!/^[a-fA-F0-9]{24}$/.test(normalizedId)) {
      window.alert(
        locale === "ar" ? "معرف الإنجاز غير صالح. لا يمكن الحذف." : "Invalid achievement id. Cannot delete."
      );
      return;
    }

    deleteFlowActiveRef.current = true;
    try {
      const confirmed = window.confirm(
        locale === "ar" ? "هل أنت متأكد من حذف هذا الإنجاز؟" : "Are you sure you want to delete this achievement?"
      );
      if (!confirmed) return;

      const response = await fetch(`/api/achievements/${encodeURIComponent(normalizedId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({} as { error?: string }));
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to delete achievement");
      }
      await fetchAchievements();
    } catch (error) {
      console.error("Error deleting achievement:", error);
      const msg = error instanceof Error ? error.message : "";
      const fallback =
        locale === "ar"
          ? "تعذر حذف الإنجاز. حاول مرة أخرى."
          : "Unable to delete achievement. Please try again.";
      window.alert(msg && msg !== "Failed to delete achievement" ? msg : fallback);
    } finally {
      deleteFlowActiveRef.current = false;
    }
  };

  // Filter achievements based on search and filters
  useEffect(() => {
    let filtered = [...achievements];

    // Search filter
    if (searchQuery) {
      const q = safeString(searchQuery).toLowerCase();
      filtered = filtered.filter((achievement) => {
        const nameHay = safeString(
          achievement.name ?? achievement.nameAr ?? achievement.nameEn ?? achievement.title ?? ""
        ).toLowerCase();
        const descHay = safeString(achievement.description).toLowerCase();
        const catHay = safeString(
          achievement.category ??
            achievement.achievementCategory ??
            achievement.domain ??
            achievement.inferredField ??
            ""
        ).toLowerCase();
        return nameHay.includes(q) || descHay.includes(q) || catHay.includes(q);
      });
    }

    // Type filter
    if (selectedType === "featured") {
      filtered = filtered.filter(
        (achievement) =>
          (achievement as { isFeatured?: boolean }).isFeatured === true || achievement.featured
      );
    } else if (selectedType === "recent") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(
        (achievement) => new Date(achievement.date) >= thirtyDaysAgo
      );
    }

    // Year filter
    if (selectedYear !== "all") {
      filtered = filtered.filter(
        (achievement) =>
          (achievement.year?.toString() || new Date(achievement.date || Date.now()).getFullYear().toString()) === selectedYear
      );
    }

    // Category/Domain filter
    if (selectedCategory !== "all") {
      const sel = safeString(selectedCategory).toLowerCase();
      filtered = filtered.filter((achievement) => {
        const v = safeString(
          achievement.category ||
            achievement.achievementCategory ||
            achievement.domain ||
            achievement.inferredField ||
            ""
        ).toLowerCase();
        return v === sel;
      });
    }

    setFilteredAchievements(filtered);
  }, [searchQuery, selectedType, selectedYear, selectedCategory, achievements]);

  return (
    <PageContainer>
      <PageHeader
        title={locale === "ar" ? "الإنجازات" : "Achievements"}
        subtitle={
          locale === "ar"
            ? "استعرض جميع الإنجازات المتميزة"
            : "Browse all outstanding achievements"
        }
        actions={
          <Link
            href="/achievements/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <PlusCircle className="h-4 w-4" />
            <span>
              {locale === "ar" ? "إضافة إنجاز" : "Add Achievement"}
            </span>
          </Link>
        }
      />

      <AchievementFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        className="mb-8"
      />

      {isLoading ? (
        <div className="py-12 text-center">
          <p className="text-text-light">{locale === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-text-light">
            {locale === "ar" ? "تم العثور على" : "Found"}{" "}
            <span className="font-semibold text-text">
              {filteredAchievements.length}
            </span>{" "}
            {locale === "ar" ? "إنجاز" : "achievement"}
            {filteredAchievements.length !== 1 ? (locale === "ar" ? "ات" : "s") : ""}
          </div>

          <AchievementGrid
            achievements={filteredAchievements.map((achievement) => {
              const rawId = achievement?.id ?? (achievement as { _id?: string })._id;
              const stableId = rawId != null && String(rawId).trim() !== "" ? String(rawId).trim() : "";
              return {
                ...achievement,
                id: stableId,
                title:
                  achievement.nameAr ||
                  achievement.nameEn ||
                  achievement.name ||
                  achievement.title ||
                  "",
                nameAr: achievement.nameAr || achievement.name || achievement.title || "",
                nameEn: achievement.nameEn || achievement.name || achievement.title || "",
                titleAr:
                  safeTrim((achievement as { titleAr?: unknown }).titleAr) ||
                  safeTrim(achievement.nameAr) ||
                  safeTrim(achievement.name) ||
                  "",
                achievementName: safeTrim(achievement.achievementName),
                customAchievementName: safeTrim(achievement.customAchievementName),
                achievementLevel: safeTrim(achievement.achievementLevel ?? (achievement as { level?: unknown }).level),
                score:
                  typeof achievement.score === "number" && Number.isFinite(achievement.score)
                    ? achievement.score
                    : undefined,
                category: achievement.achievementCategory || achievement.type || "competition",
                achievementType: achievement.achievementType || "",
                medalType: achievement.medalType || "",
                rank: achievement.rank || "",
                inferredField: achievement.inferredField || achievement.domain || "",
                resultValue: achievement.resultValue || "",
                resultType: achievement.resultType || "",
                image: achievement.image || "",
                description: safeString(achievement.description),
                approvalStatus: achievement.approvalStatus,
                status: (achievement as { status?: string }).status,
                isFeatured: (achievement as { isFeatured?: boolean }).isFeatured,
                approved: achievement.approved,
                featured: achievement.featured,
              };
            })}
            onDelete={handleDeleteAchievement}
          />
        </>
      )}
    </PageContainer>
  );
};

export default AchievementsPage;
