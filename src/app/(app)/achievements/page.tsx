"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import AchievementGrid from "@/components/achievements/AchievementGrid";
import AchievementFilters from "@/components/achievements/AchievementFilters";
import EmptyState from "@/components/layout/EmptyState";
import {
  PlusCircle,
  Filter,
  Search,
  ListFilter,
  ArrowUpDown,
  Eye,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import AuthGuardLink from "@/components/auth/AuthGuardLink";
import { getLocale } from "@/lib/i18n";
import { safeString, safeTrim } from "@/lib/achievementDisplay";
import {
  formatAchievementTypeLabel,
  formatAchievementFieldLabel,
  formatAchievementLevelLabel,
  formatDirectoryAchievementTitle,
  formatDirectoryGradeLabel,
  formatStudentGenderLabel,
  formatStudentSectionLabel,
  formatStudentSourceTypeLabel,
  formatWorkflowStatusLabel,
} from "@/lib/admin-achievement-labels";

type UserProfilePayload = { role?: string };

type AdminDirectoryItem = {
  id: string;
  title: string;
  nameAr?: string;
  nameEn?: string;
  achievementName?: string;
  customAchievementName?: string;
  achievementType: string;
  inferredField: string;
  achievementLevel: string;
  status: string;
  isFeatured: boolean;
  approved: boolean;
  achievementYear: number | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  studentSourceType: string;
  student: {
    fullName: string;
    username: string;
    studentId: string;
    gender: string;
    grade: string;
    section: string;
  };
};

type AdminDirectoryResponse = {
  items: AdminDirectoryItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

const REVIEWER_ROLES = new Set(["admin", "supervisor", "schoolAdmin", "teacher", "judge"]);

const statusBadgeClass = (status: string): string => {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-900";
  if (s === "rejected") return "bg-red-100 text-red-900";
  if (s === "needs_revision") return "bg-amber-100 text-amber-900";
  if (s === "pending_review" || s === "pending_re_review") return "bg-orange-100 text-orange-900";
  if (s === "featured") return "bg-indigo-100 text-indigo-900";
  return "bg-slate-100 text-slate-700";
};

const AchievementsPage = () => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const adminLoc = isAr ? "ar" : "en";

  const [role, setRole] = useState<string>("");
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  // Student mode state (legacy behavior, unchanged)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [achievements, setAchievements] = useState<any[]>([]);
  const [filteredAchievements, setFilteredAchievements] = useState<any[]>([]);
  const [isStudentLoading, setIsStudentLoading] = useState(true);

  // Admin mode state
  const [adminItems, setAdminItems] = useState<AdminDirectoryItem[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminTotal, setAdminTotal] = useState(0);
  const [adminPage, setAdminPage] = useState(1);
  const [adminHasMore, setAdminHasMore] = useState(false);

  const [adminQ, setAdminQ] = useState("");
  const [adminStatus, setAdminStatus] = useState("all");
  const [adminType, setAdminType] = useState("all");
  const [adminField, setAdminField] = useState("all");
  const [adminLevel, setAdminLevel] = useState("all");
  const [adminGender, setAdminGender] = useState("all");
  const [adminMawhiba, setAdminMawhiba] = useState("all");
  const [adminGrade, setAdminGrade] = useState("all");
  const [adminSection, setAdminSection] = useState("all");
  const [adminYear, setAdminYear] = useState("all");
  const [adminEntryType, setAdminEntryType] = useState("all");
  const [adminSort, setAdminSort] = useState("newest");
  const [adminFeaturedOnly, setAdminFeaturedOnly] = useState(false);
  const [adminApprovedOnly, setAdminApprovedOnly] = useState(false);
  const [adminFiltersOpen, setAdminFiltersOpen] = useState(true);

  /** Blocks window `focus` refresh while delete/confirm runs (closing confirm triggers focus). */
  const deleteFlowActiveRef = useRef(false);
  const adminQDebounceRef = useRef<number | null>(null);
  const adminQAppliedRef = useRef("");
  const isReviewer = REVIEWER_ROLES.has(String(role || ""));

  useEffect(() => {
    const loadRole = async () => {
      try {
        setIsRoleLoading(true);
        const res = await fetch("/api/user/profile", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setRole("");
          return;
        }
        const j = (await res.json()) as UserProfilePayload;
        setRole(String(j.role || ""));
      } catch (error) {
        console.error("Error fetching profile role:", error);
        setRole("");
      } finally {
        setIsRoleLoading(false);
      }
    };
    void loadRole();
  }, [router]);

  const fetchAchievements = useCallback(async () => {
    try {
      setIsStudentLoading(true);
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
      setIsStudentLoading(false);
    }
  }, [router]);

  const fetchAdminAchievements = useCallback(
    async (opts?: { append?: boolean; page?: number; qOverride?: string }) => {
      try {
        const append = opts?.append === true;
        const nextPage = Math.max(1, opts?.page || 1);
        const qValue = typeof opts?.qOverride === "string" ? opts.qOverride : adminQAppliedRef.current;
        setAdminLoading(true);
        const sp = new URLSearchParams();
        if (qValue) sp.set("q", qValue);
        if (adminStatus !== "all") sp.set("status", adminStatus);
        if (adminType !== "all") sp.set("type", adminType);
        if (adminField !== "all") sp.set("field", adminField);
        if (adminLevel !== "all") sp.set("level", adminLevel);
        if (adminGender !== "all") sp.set("gender", adminGender);
        if (adminMawhiba !== "all") sp.set("mawhiba", adminMawhiba);
        if (adminGrade !== "all") sp.set("grade", adminGrade);
        if (adminSection !== "all") sp.set("section", adminSection);
        if (adminYear !== "all") sp.set("year", adminYear);
        if (adminEntryType !== "all") sp.set("entryType", adminEntryType);
        if (adminFeaturedOnly) sp.set("featured", "true");
        if (adminApprovedOnly) sp.set("approved", "true");
        sp.set("sort", adminSort);
        sp.set("page", String(nextPage));
        sp.set("limit", "20");

        const response = await fetch(`/api/admin/achievements/directory?${sp.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (response.status === 403) {
          setAdminItems([]);
          setAdminTotal(0);
          setAdminHasMore(false);
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as AdminDirectoryResponse;
        const list = Array.isArray(data.items) ? data.items : [];
        setAdminItems((prev) => (append ? [...prev, ...list] : list));
        setAdminTotal(typeof data.total === "number" ? data.total : 0);
        setAdminPage(typeof data.page === "number" ? data.page : nextPage);
        setAdminHasMore(data.hasMore === true);
      } catch (error) {
        console.error("Error fetching admin achievements:", error);
      } finally {
        setAdminLoading(false);
      }
    },
    [
      adminApprovedOnly,
      adminEntryType,
      adminFeaturedOnly,
      adminField,
      adminGender,
      adminMawhiba,
      adminGrade,
      adminLevel,
      adminSection,
      adminSort,
      adminStatus,
      adminType,
      adminYear,
      router,
    ]
  );

  useEffect(() => {
    if (isRoleLoading || isReviewer) return;
    fetchAchievements();
  }, [fetchAchievements, isReviewer, isRoleLoading]);

  useEffect(() => {
    if (isRoleLoading || !isReviewer) return;
    void fetchAdminAchievements({ page: 1, append: false, qOverride: adminQAppliedRef.current });
  }, [
    isRoleLoading,
    isReviewer,
    fetchAdminAchievements,
    adminStatus,
    adminType,
    adminField,
    adminLevel,
    adminGender,
    adminMawhiba,
    adminGrade,
    adminSection,
    adminYear,
    adminEntryType,
    adminFeaturedOnly,
    adminApprovedOnly,
    adminSort,
  ]);

  useEffect(() => {
    if (isRoleLoading || !isReviewer) return;
    if (adminQDebounceRef.current) window.clearTimeout(adminQDebounceRef.current);
    adminQDebounceRef.current = window.setTimeout(() => {
      adminQAppliedRef.current = adminQ.trim();
      void fetchAdminAchievements({ page: 1, append: false, qOverride: adminQ.trim() });
    }, 300);
    return () => {
      if (adminQDebounceRef.current) window.clearTimeout(adminQDebounceRef.current);
    };
  }, [adminQ, fetchAdminAchievements, isReviewer, isRoleLoading]);

  // Refresh when page gains focus (user returns from creating achievement)
  useEffect(() => {
    const handleFocus = () => {
      if (deleteFlowActiveRef.current) return;
      router.refresh();
      if (isReviewer) {
        void fetchAdminAchievements({ page: 1, append: false, qOverride: adminQAppliedRef.current });
      } else {
        fetchAchievements();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [router, fetchAchievements, fetchAdminAchievements, isReviewer]);

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
    if (isReviewer) return;
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
  }, [searchQuery, selectedType, selectedYear, selectedCategory, achievements, isReviewer]);

  const adminFiltersActive = useMemo(
    () =>
      Boolean(adminQ.trim()) ||
      adminStatus !== "all" ||
      adminType !== "all" ||
      adminField !== "all" ||
      adminLevel !== "all" ||
      adminGender !== "all" ||
      adminMawhiba !== "all" ||
      adminGrade !== "all" ||
      adminSection !== "all" ||
      adminYear !== "all" ||
      adminEntryType !== "all" ||
      adminFeaturedOnly ||
      adminApprovedOnly ||
      adminSort !== "newest",
    [
      adminApprovedOnly,
      adminEntryType,
      adminFeaturedOnly,
      adminField,
      adminGender,
      adminMawhiba,
      adminGrade,
      adminLevel,
      adminQ,
      adminSection,
      adminSort,
      adminStatus,
      adminType,
      adminYear,
    ]
  );

  const clearAdminFilters = () => {
    setAdminQ("");
    setAdminStatus("all");
    setAdminType("all");
    setAdminField("all");
    setAdminLevel("all");
    setAdminGender("all");
    setAdminMawhiba("all");
    setAdminGrade("all");
    setAdminSection("all");
    setAdminYear("all");
    setAdminEntryType("all");
    setAdminSort("newest");
    setAdminFeaturedOnly(false);
    setAdminApprovedOnly(false);
  };

  return (
    <PageContainer>
      <PageHeader
        title={locale === "ar" ? "الإنجازات" : "Achievements"}
        subtitle={
          isReviewer
            ? locale === "ar"
              ? "عرض شامل لجميع إنجازات النظام (لوحة إدارية)"
              : "System-wide achievements directory (admin view)"
            : locale === "ar"
              ? "استعرض جميع الإنجازات المتميزة"
              : "Browse all outstanding achievements"
        }
        actions={
          isReviewer ? (
            <Link
              href="/admin/achievements/review"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{isAr ? "لوحة المراجعة" : "Review board"}</span>
            </Link>
          ) : (
            <AuthGuardLink
              href="/achievements/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{locale === "ar" ? "إضافة إنجاز" : "Add Achievement"}</span>
            </AuthGuardLink>
          )
        }
      />

      {isRoleLoading ? (
        <div className="py-12 text-center">
          <p className="text-text-light">{locale === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      ) : isReviewer ? (
        <>
          <div className="mb-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-light" />
              <input
                value={adminQ}
                onChange={(e) => setAdminQ(e.target.value)}
                placeholder={
                  isAr
                    ? "بحث بالإنجاز / الطالب / اسم المستخدم / رقم الطالب / المجال..."
                    : "Search by achievement / student / username / student ID / domain..."
                }
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-4 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAdminFiltersOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-text hover:bg-gray-50"
              >
                <Filter className="h-4 w-4" />
                {isAr ? "فلاتر متقدمة" : "Advanced filters"}
              </button>
              {adminFiltersActive ? (
                <button
                  type="button"
                  onClick={clearAdminFilters}
                  className="text-sm font-semibold text-primary hover:text-primary-dark"
                >
                  {isAr ? "مسح الفلاتر" : "Clear filters"}
                </button>
              ) : null}
            </div>

            {adminFiltersOpen ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select value={adminStatus} onChange={(e) => setAdminStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل الحالات" : "All statuses"}</option>
                  <option value="pending">{isAr ? "قيد الانتظار" : "Pending"}</option>
                  <option value="pending_review">{isAr ? "بانتظار المراجعة" : "Pending review"}</option>
                  <option value="pending_re_review">{isAr ? "بانتظار إعادة المراجعة" : "Pending re-review"}</option>
                  <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
                  <option value="featured">{isAr ? "مميز" : "Featured"}</option>
                  <option value="needs_revision">{isAr ? "يحتاج تعديل" : "Needs revision"}</option>
                  <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
                </select>
                <select value={adminType} onChange={(e) => setAdminType(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل الأنواع" : "All types"}</option>
                  <option value="competition">{isAr ? "مسابقة" : "Competition"}</option>
                  <option value="program">{isAr ? "برنامج" : "Program"}</option>
                  <option value="olympiad">{isAr ? "أولمبياد" : "Olympiad"}</option>
                  <option value="mawhiba">{isAr ? "موهبة" : "Mawhiba"}</option>
                  <option value="qudrat">{isAr ? "قدرات" : "Qudrat"}</option>
                </select>
                <select value={adminField} onChange={(e) => setAdminField(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل المجالات" : "All fields"}</option>
                  <option value="science">{isAr ? "العلوم" : "Science"}</option>
                  <option value="technology">{isAr ? "التقنية" : "Technology"}</option>
                  <option value="sports">{isAr ? "الرياضة" : "Sports"}</option>
                  <option value="arts">{isAr ? "الفنون" : "Arts"}</option>
                </select>
                <select value={adminLevel} onChange={(e) => setAdminLevel(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل المستويات" : "All levels"}</option>
                  <option value="school">{isAr ? "المدرسة" : "School"}</option>
                  <option value="province">{isAr ? "المحافظة" : "Province"}</option>
                  <option value="kingdom">{isAr ? "المملكة" : "Kingdom"}</option>
                  <option value="international">{isAr ? "الدولي" : "International"}</option>
                </select>
                <select value={adminGender} onChange={(e) => setAdminGender(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل الأنواع (الطالب)" : "All genders"}</option>
                  <option value="male">{isAr ? "طالب" : "Male"}</option>
                  <option value="female">{isAr ? "طالبة" : "Female"}</option>
                </select>
                <select
                  value={adminMawhiba}
                  onChange={(e) => setAdminMawhiba(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">{isAr ? "موهبة: الكل" : "Mawhiba: all"}</option>
                  <option value="yes">{isAr ? "طلاب موهبة" : "Mawhiba students"}</option>
                  <option value="no">{isAr ? "غير موهبة" : "Non‑Mawhiba"}</option>
                </select>
                <select value={adminGrade} onChange={(e) => setAdminGrade(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل الصفوف" : "All grades"}</option>
                  <option value="grade1">1</option><option value="grade2">2</option><option value="grade3">3</option>
                  <option value="grade4">4</option><option value="grade5">5</option><option value="grade6">6</option>
                  <option value="grade7">7</option><option value="grade8">8</option><option value="grade9">9</option>
                  <option value="grade10">10</option><option value="grade11">11</option><option value="grade12">12</option>
                </select>
                <select value={adminSection} onChange={(e) => setAdminSection(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل المسارات" : "All tracks"}</option>
                  <option value="arabic">{isAr ? "عربي" : "Arabic"}</option>
                  <option value="international">{isAr ? "دولي" : "International"}</option>
                </select>
                <select value={adminYear} onChange={(e) => setAdminYear(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل السنوات" : "All years"}</option>
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const y = new Date().getFullYear() - idx;
                    return <option key={y} value={String(y)}>{y}</option>;
                  })}
                </select>
                <select value={adminEntryType} onChange={(e) => setAdminEntryType(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="all">{isAr ? "كل مصادر الإدخال" : "All entry sources"}</option>
                  <option value="student_registered">{isAr ? "طالب مسجل" : "Registered student"}</option>
                  <option value="admin_manual">{isAr ? "إدخال إداري" : "Admin manual entry"}</option>
                  <option value="external_graduate">{isAr ? "طالب خارجي / خريج" : "External / alumni"}</option>
                  <option value="linked_account">{isAr ? "مرتبط بحساب" : "Linked account"}</option>
                </select>
                <select value={adminSort} onChange={(e) => setAdminSort(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="newest">{isAr ? "الأحدث إضافة" : "Newest created"}</option>
                  <option value="oldest">{isAr ? "الأقدم إضافة" : "Oldest created"}</option>
                  <option value="updated_desc">{isAr ? "الأحدث تحديثًا" : "Latest updated"}</option>
                  <option value="year_desc">{isAr ? "سنة الإنجاز (تنازلي)" : "Achievement year (desc)"}</option>
                  <option value="year_asc">{isAr ? "سنة الإنجاز (تصاعدي)" : "Achievement year (asc)"}</option>
                  <option value="status_asc">{isAr ? "حسب الحالة" : "By status"}</option>
                  <option value="student_asc">{isAr ? "حسب اسم الطالب" : "By student name"}</option>
                  <option value="achievement_asc">{isAr ? "حسب اسم الإنجاز" : "By achievement name"}</option>
                </select>
                <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <input type="checkbox" checked={adminFeaturedOnly} onChange={(e) => setAdminFeaturedOnly(e.target.checked)} />
                  {isAr ? "المميز فقط" : "Featured only"}
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <input type="checkbox" checked={adminApprovedOnly} onChange={(e) => setAdminApprovedOnly(e.target.checked)} />
                  {isAr ? "المعتمد فقط" : "Approved only"}
                </label>
              </div>
            ) : null}
          </div>

          <div className="mb-4 flex items-center gap-2 text-sm text-text-light">
            <ListFilter className="h-4 w-4" />
            <span>{isAr ? "تم العثور على" : "Found"}</span>
            <span className="font-semibold text-text">{adminTotal.toLocaleString(isAr ? "ar-SA" : "en-US")}</span>
            <span>{isAr ? "إنجاز" : "achievements"}</span>
            {adminSort !== "newest" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {isAr ? "فرز مخصص" : "Custom sort"}
              </span>
            ) : null}
          </div>

          {adminLoading && adminItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-text-light">{isAr ? "جاري تحميل بيانات الإنجازات..." : "Loading achievements..."}</p>
            </div>
          ) : adminItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title={isAr ? "لا توجد إنجازات مطابقة" : "No matching achievements"}
              description={
                isAr
                  ? "جرّب تعديل كلمات البحث أو الفلاتر للحصول على نتائج."
                  : "Try changing your search keywords or filters."
              }
            />
          ) : (
            <div className="space-y-3">
              {adminItems.map((item) => (
                <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-text">
                          {formatDirectoryAchievementTitle(
                            {
                              title: item.title,
                              nameAr: item.nameAr,
                              nameEn: item.nameEn,
                              achievementName: item.achievementName,
                              customAchievementName: item.customAchievementName,
                            },
                            adminLoc
                          )}
                        </h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                          {formatWorkflowStatusLabel(item.status, adminLoc)}
                        </span>
                        {item.isFeatured ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900">
                            {isAr ? "مميز" : "Featured"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-text-light">
                        {isAr ? "الطالب:" : "Student:"}{" "}
                        <span className="font-medium text-text">{item.student.fullName || "—"}</span>
                        {" • "}
                        {isAr ? "رقم الطالب:" : "Student ID:"}{" "}
                        <span className="font-medium text-text">{item.student.studentId || "—"}</span>
                        {" • "}
                        {isAr ? "اسم المستخدم:" : "Username:"}{" "}
                        <span className="font-medium text-text">{item.student.username || "—"}</span>
                      </p>
                      <div className="mt-2 grid gap-2 text-xs text-text-light sm:grid-cols-2 lg:grid-cols-4">
                        <p>
                          {isAr ? "النوع" : "Type"}:{" "}
                          <span className="font-semibold text-text">
                            {formatAchievementTypeLabel(item.achievementType, adminLoc)}
                          </span>
                        </p>
                        <p>
                          {isAr ? "المجال" : "Field"}:{" "}
                          <span className="font-semibold text-text">
                            {formatAchievementFieldLabel(item.inferredField, adminLoc)}
                          </span>
                        </p>
                        <p>
                          {isAr ? "المستوى" : "Level"}:{" "}
                          <span className="font-semibold text-text">
                            {formatAchievementLevelLabel(item.achievementLevel, adminLoc)}
                          </span>
                        </p>
                        <p>{isAr ? "السنة" : "Year"}: <span className="font-semibold text-text">{item.achievementYear ?? "—"}</span></p>
                        <p>
                          {isAr ? "الصف" : "Grade"}:{" "}
                          <span className="font-semibold text-text">
                            {formatDirectoryGradeLabel(item.student.grade, adminLoc)}
                          </span>
                        </p>
                        <p>
                          {isAr ? "المسار" : "Track"}:{" "}
                          <span className="font-semibold text-text">
                            {formatStudentSectionLabel(item.student.section, adminLoc)}
                          </span>
                        </p>
                        <p>
                          {isAr ? "النوع (جنس)" : "Gender"}:{" "}
                          <span className="font-semibold text-text">
                            {formatStudentGenderLabel(item.student.gender, adminLoc)}
                          </span>
                        </p>
                        <p>
                          {isAr ? "مصدر الإدخال" : "Entry source"}:{" "}
                          <span className="font-semibold text-text">
                            {formatStudentSourceTypeLabel(item.studentSourceType, adminLoc)}
                          </span>
                        </p>
                        <p>{isAr ? "تاريخ الإنجاز" : "Achievement date"}: <span className="font-semibold text-text">{item.date || "—"}</span></p>
                        <p>{isAr ? "أضيف في" : "Created"}: <span className="font-semibold text-text">{item.createdAt ? new Date(item.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "—"}</span></p>
                        <p>{isAr ? "آخر تحديث" : "Last update"}: <span className="font-semibold text-text">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "—"}</span></p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        href={`/achievements/${item.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-text hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" />
                        {isAr ? "التفاصيل" : "Details"}
                      </Link>
                      <Link
                        href={`/admin/achievements/review/${item.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {isAr ? "المراجعة" : "Review"}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}

              {adminHasMore ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    disabled={adminLoading}
                    onClick={() => void fetchAdminAchievements({ append: true, page: adminPage + 1 })}
                    className="inline-flex items-center rounded-xl border border-primary/30 bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  >
                    {adminLoading
                      ? isAr
                        ? "جاري التحميل..."
                        : "Loading..."
                      : isAr
                        ? "تحميل المزيد"
                        : "Load more"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <>
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

          {isStudentLoading ? (
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
                    participationType: safeTrim((achievement as { participationType?: unknown }).participationType),
                    achievementYear:
                      typeof (achievement as { achievementYear?: unknown }).achievementYear === "number"
                        ? ((achievement as { achievementYear: number }).achievementYear as number)
                        : null,
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
        </>
      )}
    </PageContainer>
  );
};

export default AchievementsPage;
