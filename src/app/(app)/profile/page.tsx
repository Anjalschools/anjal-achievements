"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import SectionCard from "@/components/layout/SectionCard";
import StatCard from "@/components/layout/StatCard";
import StudentPublicPortfolioCard from "@/components/profile/StudentPublicPortfolioCard";
import type { UserPublicPortfolioPayload } from "@/lib/user-public-portfolio-types";
import { Edit, Trophy, Award, Calendar, User, PlusCircle, ArrowRight, Phone, Mail, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getLocale } from "@/lib/i18n";
import { getGradeLabel } from "@/constants/grades";
import {
  getGenderLabel,
  getSectionLabel,
  getVerificationStatusLabel,
} from "@/lib/achievement-display-labels";
import {
  getAchievementDisplayName,
  getAchievementLevelLabel,
  getAchievementScoreDisplay,
  safeString,
  safeTrim,
} from "@/lib/achievementDisplay";
import { countsTowardApprovedScore } from "@/lib/achievementWorkflow";
import { isAchievementReviewerRole } from "@/lib/achievement-reviewer-roles";
import { isAdminManagerRole } from "@/lib/app-navigation-roles";
import type { AdminDashboardPayload } from "@/lib/admin-dashboard-stats";
import ReviewerProfileSection, {
  type ReviewerProfileUserPayload,
} from "@/components/profile/ReviewerProfileSection";

/** Tier order for "أعلى مستوى" — higher = better (aligned with scoring tiers). */
const LEVEL_RANK: Record<string, number> = {
  school: 1,
  province: 2,
  governorate: 2,
  district: 2,
  regional: 2,
  local: 2,
  admin: 2,
  administration: 2,
  local_authority: 2,
  national: 3,
  kingdom: 3,
  international: 4,
  global: 4,
  world: 4,
};

const numericScore = (a: Record<string, unknown>): number => {
  const v = a?.score;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && safeTrim(v) !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

const levelRank = (raw: unknown): number => {
  const k = safeTrim(raw).toLowerCase().replace(/\s+/g, "_");
  return LEVEL_RANK[k] ?? 0;
};

type ProfileInsights = {
  thisYearCount: number;
  bestAchievement: Record<string, unknown> | null;
  maxLevelRaw: string;
};

const emptyInsights = (): ProfileInsights => ({
  thisYearCount: 0,
  bestAchievement: null,
  maxLevelRaw: "",
});

const ProfilePage = () => {
  const router = useRouter();
  const [userData, setUserData] = useState({
    fullName: "",
    email: "",
    username: "",
    studentId: "",
    nationalId: "",
    gender: "",
    grade: "",
    section: "",
    phone: "",
    guardianName: "",
    guardianPhone: "",
    avatar: undefined as string | undefined,
  });

  const [stats, setStats] = useState({
    totalAchievements: 0,
    featuredAchievements: 0,
    participationCount: 0,
    yearsActive: 0,
  });

  const [avatarFailed, setAvatarFailed] = useState(false);

  const locale = getLocale();
  const loc = locale === "ar" ? "ar" : "en";

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const [recentAchievementsList, setRecentAchievementsList] = useState<Record<string, unknown>[]>([]);
  const [insights, setInsights] = useState<ProfileInsights>(emptyInsights);
  const [totalScore, setTotalScore] = useState(0);
  const [userRole, setUserRole] = useState("");
  const [publicPortfolio, setPublicPortfolio] = useState<UserPublicPortfolioPayload | null>(null);
  const [publicPortfolioError, setPublicPortfolioError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const profileLoadAbortRef = useRef<AbortController | null>(null);

  const [reviewerProfile, setReviewerProfile] = useState<ReviewerProfileUserPayload | null>(null);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardPayload | null>(null);
  const [adminDashboardError, setAdminDashboardError] = useState<string | null>(null);

  const applyAchievementsList = useCallback((raw: unknown) => {
    const list = Array.isArray(raw) ? raw : [];
    const asRecords = list as Record<string, unknown>[];

    const sum = asRecords.reduce((s, a) => {
      if (!countsTowardApprovedScore(a)) return s;
      return s + numericScore(a);
    }, 0);
    setTotalScore(sum);

    let best: Record<string, unknown> | null = null;
    let bestScore = -1;
    let maxR = 0;
    let maxLevelRaw = "";
    let thisYearCount = 0;
    const currentYear = new Date().getFullYear();

    for (const achievement of asRecords) {
      if (!countsTowardApprovedScore(achievement)) continue;
      const sc = numericScore(achievement);
      if (sc > bestScore) {
        bestScore = sc;
        best = achievement;
      }

      const lvlRaw = achievement.achievementLevel ?? achievement.level ?? "";
      const r = levelRank(lvlRaw);
      if (r > maxR) {
        maxR = r;
        maxLevelRaw = safeString(lvlRaw);
      }

      const year =
        typeof achievement.year === "number"
          ? achievement.year
          : achievement.date
            ? new Date(safeString(achievement.date)).getFullYear()
            : null;
      if (year === currentYear) thisYearCount += 1;
    }

    setInsights({
      thisYearCount,
      bestAchievement: best,
      maxLevelRaw: maxLevelRaw || "",
    });

    const sorted = [...asRecords].sort((a, b) => {
      const da = new Date(safeString(a.date || a.createdAt || 0)).getTime();
      const db = new Date(safeString(b.date || b.createdAt || 0)).getTime();
      return db - da;
    });
    setRecentAchievementsList(sorted.slice(0, 5));
  }, []);

  const loadProfileData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      profileLoadAbortRef.current?.abort();
      const ac = new AbortController();
      profileLoadAbortRef.current = ac;
      const signal = ac.signal;

      if (!silent) {
        setProfileLoading(true);
        setPublicPortfolioError(null);
        setAdminDashboardError(null);
      }

      try {
        const profileResponse = await fetch("/api/user/profile", { credentials: "same-origin", signal });

        if (profileResponse.status === 401) {
          router.push("/login");
          return;
        }

        if (!profileResponse.ok) {
          if (!silent) setProfileLoading(false);
          return;
        }

        const profileData = (await profileResponse.json()) as Record<string, unknown>;
        const resolvedRole = String(profileData.role || "");
        setUserRole(resolvedRole);
        setUserData({
          fullName: String(profileData.fullName || ""),
          email: String(profileData.email || ""),
          username: String(profileData.username || ""),
          studentId: String(profileData.studentId || ""),
          nationalId: String(profileData.nationalId || ""),
          gender: String(profileData.gender || ""),
          grade: String(profileData.grade || ""),
          section: String(profileData.section || ""),
          phone: String(profileData.phone || ""),
          guardianName: String(profileData.guardianName || ""),
          guardianPhone: String(profileData.guardianPhone || ""),
          avatar: typeof profileData.profilePhoto === "string" ? profileData.profilePhoto : undefined,
        });

        if (isAchievementReviewerRole(resolvedRole)) {
          setReviewerProfile({
            fullName: String(profileData.fullName || ""),
            email: String(profileData.email || ""),
            username: String(profileData.username || ""),
            phone: String(profileData.phone || ""),
            profilePhoto: typeof profileData.profilePhoto === "string" ? profileData.profilePhoto : undefined,
            role: resolvedRole,
            preferredLanguage:
              profileData.preferredLanguage === "en" || profileData.preferredLanguage === "ar"
                ? profileData.preferredLanguage
                : undefined,
            accountStatus: typeof profileData.accountStatus === "string" ? profileData.accountStatus : "active",
            createdAt: typeof profileData.createdAt === "string" ? profileData.createdAt : undefined,
            lastLoginAt:
              profileData.lastLoginAt === null
                ? null
                : typeof profileData.lastLoginAt === "string"
                  ? profileData.lastLoginAt
                  : null,
          });
          setPublicPortfolio(null);
          setPublicPortfolioError(null);

          const dashRes = await fetch("/api/admin/dashboard", { cache: "no-store", credentials: "same-origin", signal });
          if (dashRes.ok) {
            const dash = (await dashRes.json()) as AdminDashboardPayload;
            setAdminDashboard(dash);
            setAdminDashboardError(null);
          } else {
            setAdminDashboard(null);
            setAdminDashboardError(
              locale === "ar"
                ? "تعذر تحميل إحصاءات لوحة الإدارة. قد لا تملك صلاحية كافية."
                : "Could not load admin dashboard metrics. You may not have access."
            );
          }
          if (!silent) setProfileLoading(false);
          return;
        }

        setReviewerProfile(null);
        setAdminDashboard(null);
        setAdminDashboardError(null);

        const [statsResponse, achievementsResponse, portfolioResponse] = await Promise.all([
          fetch("/api/user/stats", { cache: "no-store", credentials: "same-origin", signal }),
          fetch("/api/achievements", { cache: "no-store", credentials: "same-origin", signal }),
          fetch("/api/user/public-portfolio", { cache: "no-store", credentials: "same-origin", signal }),
        ]);

        if (statsResponse.status === 401 || achievementsResponse.status === 401 || portfolioResponse.status === 401) {
          router.push("/login");
          return;
        }

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
          if (typeof statsData.totalScore === "number") {
            setTotalScore(statsData.totalScore);
          }
        }

        if (achievementsResponse.ok) {
          const allAchievements = await achievementsResponse.json();
          applyAchievementsList(allAchievements);
        } else {
          setTotalScore(0);
          setInsights(emptyInsights());
          setRecentAchievementsList([]);
        }

        if (resolvedRole !== "student") {
          setPublicPortfolio(null);
          setPublicPortfolioError(null);
        } else if (portfolioResponse.status === 403) {
          setPublicPortfolio(null);
          setPublicPortfolioError(null);
        } else if (portfolioResponse.ok) {
          const pj = (await portfolioResponse.json()) as UserPublicPortfolioPayload;
          setPublicPortfolio(pj);
          if (process.env.NODE_ENV === "development") {
            console.info("[profile-page] public portfolio payload ready", {
              enabled: pj.enabled,
              slug: pj.slug ?? null,
              hasToken: Boolean(pj.token && String(pj.token).trim()),
              publicUrl: pj.publicUrl ?? null,
            });
          }
        } else if (!silent) {
          const j = (await portfolioResponse.json().catch(() => ({}))) as { error?: string };
          setPublicPortfolioError(
            typeof j.error === "string"
              ? j.error
              : locale === "ar"
                ? "تعذر تحميل ملف الإنجاز العام"
                : "Could not load public portfolio"
          );
          setPublicPortfolio(null);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error fetching user data:", error);
      } finally {
        if (!silent) setProfileLoading(false);
      }
    },
    [applyAchievementsList, router, locale]
  );

  const handlePublicPortfolioRetry = useCallback(() => {
    void loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    void loadProfileData();
    return () => profileLoadAbortRef.current?.abort();
  }, [loadProfileData]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [userData.avatar]);

  useEffect(() => {
    const handleFocus = () => {
      router.refresh();
      void loadProfileData({ silent: true });
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [router, loadProfileData]);

  const bestName = insights.bestAchievement
    ? getAchievementDisplayName(insights.bestAchievement, loc)
    : "";
  const bestScoreNum = insights.bestAchievement ? numericScore(insights.bestAchievement) : 0;
  const bestScoreLine =
    insights.bestAchievement != null
      ? locale === "ar"
        ? `${Math.round(bestScoreNum)} نقطة`
        : `${Math.round(bestScoreNum)} pts`
      : "—";
  const maxLevelLabel = insights.maxLevelRaw
    ? getAchievementLevelLabel(insights.maxLevelRaw, loc)
    : getAchievementLevelLabel(undefined, loc);

  const avatarSrc = userData.avatar?.trim() ?? "";
  const showAvatar =
    Boolean(avatarSrc) &&
    !avatarFailed &&
    (avatarSrc.startsWith("/") ||
      avatarSrc.startsWith("data:") ||
      avatarSrc.startsWith("http://") ||
      avatarSrc.startsWith("https://"));
  const avatarUnopt =
    avatarSrc.startsWith("data:") || avatarSrc.startsWith("http://") || avatarSrc.startsWith("https://");

  if (profileLoading) {
    return (
      <PageContainer>
        <div className="py-16 text-center text-text-light" role="status">
          {locale === "ar" ? "جاري التحميل..." : "Loading..."}
        </div>
      </PageContainer>
    );
  }

  if (isAchievementReviewerRole(userRole) && reviewerProfile) {
    return (
      <PageContainer>
        <ReviewerProfileSection
          user={reviewerProfile}
          dashboard={adminDashboard}
          dashboardError={adminDashboardError}
          canManageUsers={isAdminManagerRole(userRole)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Profile Header Card */}
      <SectionCard className="mb-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Avatar Section */}
          <div className="flex flex-col items-center md:items-start">
            <div className="relative mb-4 h-24 w-24 shrink-0">
              {showAvatar ? (
                <Image
                  src={avatarSrc}
                  alt={userData.fullName || "User"}
                  fill
                  unoptimized={avatarUnopt}
                  className="rounded-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                  {getInitials(userData.fullName)}
                </div>
              )}
            </div>
            <div className="text-center md:text-right">
              <h1 className="mb-1 text-2xl font-bold text-text">{userData.fullName || (locale === "ar" ? "المستخدم" : "User")}</h1>
              <p className="mb-4 flex items-center justify-center gap-2 text-sm text-text-light md:justify-start">
                <Mail className="h-4 w-4" />
                {userData.email || ""}
              </p>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 space-y-4 border-t border-gray-200 pt-6 md:border-t-0 md:border-r md:pr-6 md:pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">
                  {locale === "ar" ? "اسم المستخدم" : "Username"}
                </p>
                <p className="text-sm font-semibold text-text">{userData.username || "-"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">
                  {locale === "ar" ? "رقم الطالب" : "Student ID"}
                </p>
                <p className="text-sm font-semibold text-text">{userData.studentId || "-"}</p>
              </div>
              {userData.nationalId && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-light">
                    {locale === "ar" ? "رقم الهوية" : "National ID"}
                  </p>
                  <p className="text-sm font-semibold text-text">{userData.nationalId}</p>
                </div>
              )}
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">
                  {locale === "ar" ? "الجنس" : "Gender"}
                </p>
                <p className="text-sm font-semibold text-text">
                  {userData.gender ? getGenderLabel(userData.gender, loc) : "-"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">
                  {locale === "ar" ? "الصف" : "Grade"}
                </p>
                <p className="text-sm font-semibold text-text">
                  {userData.grade ? getGradeLabel(userData.grade, locale) : "-"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">
                  {locale === "ar" ? "القسم" : "Section"}
                </p>
                <p className="text-sm font-semibold text-text">
                  {userData.section ? getSectionLabel(userData.section, loc) : "-"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-text-light">
                  {locale === "ar" ? "رقم الجوال" : "Phone"}
                </p>
                <p className="flex items-center gap-2 text-sm font-semibold text-text">
                  <Phone className="h-3 w-3" />
                  {userData.phone || "-"}
                </p>
              </div>
              {userData.guardianName && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-light">
                    {locale === "ar" ? "اسم ولي الأمر" : "Parent Name"}
                  </p>
                  <p className="text-sm font-semibold text-text">{userData.guardianName}</p>
                </div>
              )}
              {userData.guardianPhone && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-light">
                    {locale === "ar" ? "جوال ولي الأمر" : "Parent Phone"}
                  </p>
                  <p className="flex items-center gap-2 text-sm font-semibold text-text">
                    <Phone className="h-3 w-3" />
                    {userData.guardianPhone}
                  </p>
                </div>
              )}
            </div>

            {/* Edit Button */}
            <div className="pt-2">
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-gray-50"
              >
                <Edit className="h-4 w-4" />
                <span>{locale === "ar" ? "تعديل الملف الشخصي" : "Edit Profile"}</span>
              </Link>
            </div>
          </div>
        </div>
      </SectionCard>

      {userRole === "student" ? (
        <div className="mb-6">
          <StudentPublicPortfolioCard
            data={publicPortfolio}
            loading={profileLoading}
            error={publicPortfolioError}
            onRetry={handlePublicPortfolioRetry}
          />
        </div>
      ) : null}

      {/* Stats Grid */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title={locale === "ar" ? "إجمالي الإنجازات" : "Total Achievements"}
          value={stats.totalAchievements}
          icon={Trophy}
        />
        <StatCard
          title={locale === "ar" ? "إجمالي النقاط" : "Total points"}
          value={totalScore}
          icon={Star}
        />
        <StatCard
          title={locale === "ar" ? "إنجازات مميزة" : "Featured Achievements"}
          value={stats.featuredAchievements}
          icon={Award}
        />
        <StatCard
          title={locale === "ar" ? "عدد المشاركات" : "Participation Count"}
          value={stats.participationCount}
          icon={Calendar}
        />
        <StatCard
          title={locale === "ar" ? "سنوات النشاط" : "Years Active"}
          value={stats.yearsActive}
          icon={User}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Achievement Summary */}
        <SectionCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-text">
              {locale === "ar" ? "ملخص الإنجازات" : "Achievement Summary"}
            </h3>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-primary/5 to-primary/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text">
                    {locale === "ar" ? "إنجازات هذا العام" : "This Year's Achievements"}
                  </p>
                  <p className="mt-1 text-xs text-text-light">
                    {locale === "ar"
                      ? `${insights.thisYearCount} إنجاز في ${new Date().getFullYear()}`
                      : `${insights.thisYearCount} achievements in ${new Date().getFullYear()}`}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-gradient-to-br from-amber-50 to-amber-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-bold text-text">
                    {locale === "ar" ? "أفضل إنجاز" : "Best achievement"}
                  </p>
                  {bestName ? (
                    <>
                      <p className="text-sm font-semibold text-text">{bestName}</p>
                      <p className="flex items-center gap-1.5 text-base font-extrabold text-amber-800">
                        <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
                        {bestScoreLine}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-text-light">
                      {locale === "ar" ? "لا توجد نقاط مسجلة بعد" : "No scored achievements yet"}
                    </p>
                  )}
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <Star className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-secondary/5 to-secondary/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-bold text-text">
                    {locale === "ar" ? "أعلى مستوى" : "Highest level reached"}
                  </p>
                  <p className="text-sm font-semibold text-text">{maxLevelLabel}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary/20">
                  <Award className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Recent Activity */}
        <SectionCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-text">
              {locale === "ar" ? "النشاط الأخير" : "Recent Activity"}
            </h3>
            <Link
              href="/achievements"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              {locale === "ar" ? "عرض الكل" : "View All"}
            </Link>
          </div>
          {recentAchievementsList.length > 0 ? (
            <div className="space-y-3">
              {recentAchievementsList.map((activity, index) => {
                const id = safeString(activity.id ?? (activity as { _id?: unknown })._id);
                const displayTitle = getAchievementDisplayName(activity, loc);
                const levelRaw = activity.achievementLevel ?? activity.level ?? "";
                const levelLine = getAchievementLevelLabel(levelRaw, loc);
                const scoreStr = getAchievementScoreDisplay(activity, loc);
                const scoreLine =
                  scoreStr !== "—"
                    ? locale === "ar"
                      ? `⭐ ${scoreStr} نقطة`
                      : `⭐ ${scoreStr} pts`
                    : locale === "ar"
                      ? "⭐ —"
                      : "⭐ —";

                return (
                  <Link
                    key={id || `recent-${index}`}
                    href={id ? `/achievements/${id}` : "/achievements"}
                    className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-text">{displayTitle}</p>
                      <p className="text-sm font-medium text-text">
                        {locale === "ar" ? "المستوى: " : "Level: "}
                        <span className="text-text">{levelLine}</span>
                      </p>
                      <p className="text-base font-extrabold text-amber-800">{scoreLine}</p>
                      <p className="text-xs text-text-light">
                        {new Date(safeString(activity.date || activity.createdAt || Date.now())).toLocaleDateString(
                          locale === "ar" ? "ar-SA" : "en-US"
                        )}{" "}
                        •{" "}
                        {getVerificationStatusLabel(activity.verificationStatus, loc)}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-text-light opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Trophy className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm text-text-light">
                {locale === "ar" ? "لا يوجد نشاط حديث" : "No recent activity"}
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* CTA Section */}
      <SectionCard className="mt-6 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <h3 className="mb-1 text-lg font-bold text-text">
              {locale === "ar" ? "ابدأ بإضافة إنجازك" : "Start Adding Your Achievement"}
            </h3>
            <p className="text-sm text-text-light">
              {locale === "ar"
                ? "شارك إنجازاتك مع المجتمع التعليمي واحصل على التقدير"
                : "Share your achievements with the educational community and get recognition"}
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link
              href="/achievements/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{locale === "ar" ? "إضافة إنجاز" : "Add Achievement"}</span>
            </Link>
            <Link
              href="/achievements"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-text transition-colors hover:bg-gray-50"
            >
              <span>{locale === "ar" ? "عرض الإنجازات" : "View Achievements"}</span>
            </Link>
          </div>
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default ProfilePage;
