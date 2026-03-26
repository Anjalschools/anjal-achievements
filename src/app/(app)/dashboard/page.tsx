"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import StatCard from "@/components/layout/StatCard";
import EmptyState from "@/components/layout/EmptyState";
import {
  Trophy,
  Award,
  Clock,
  FileBadge,
  PlusCircle,
  Eye,
  User,
  Star,
  ClipboardList,
  Link2,
  Copy,
  QrCode,
} from "lucide-react";
import { getLocale } from "@/lib/i18n";
import AchievementStatusBadge from "@/components/achievements/AchievementStatusBadge";
import type { WorkflowDisplayStatus } from "@/lib/achievementWorkflow";
import type { DashboardAchievementRow } from "@/lib/dashboard-achievement-format";
import type { UserPublicPortfolioPayload } from "@/lib/user-public-portfolio-types";

type DashboardPayload = {
  totalAchievements: number;
  points: number;
  certificatesIssued: number;
  pendingReviewCount: number;
  recentPeriodCount: number;
  participationCount: number;
  lastAchievement: { id: string; title: string; date: string | null } | null;
  recentAchievements: DashboardAchievementRow[];
};

type UserRankPayload = {
  ok: boolean;
  totalPoints: number;
  achievementsCount: number;
  rank: number | null;
  totalRankedStudents: number;
};

const DashboardPage = () => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [publicPortfolio, setPublicPortfolio] = useState<UserPublicPortfolioPayload | null>(null);
  const [publicPortfolioLoading, setPublicPortfolioLoading] = useState(true);
  const [publicPortfolioQrDataUrl, setPublicPortfolioQrDataUrl] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [rankData, setRankData] = useState<UserRankPayload | null>(null);
  const [rankLoading, setRankLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const loc = isAr ? "ar" : "en";
        const res = await fetch(`/api/user/dashboard?locale=${loc}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as DashboardPayload;
          setData(json);
        } else {
          setData(null);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchData();
  }, [isAr, router]);

  useEffect(() => {
    const fetchRankData = async () => {
      try {
        setRankLoading(true);
        const res = await fetch("/api/user/rank", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setRankData(null);
          return;
        }
        const json = (await res.json()) as UserRankPayload;
        setRankData(json?.ok ? json : null);
      } catch {
        setRankData(null);
      } finally {
        setRankLoading(false);
      }
    };
    void fetchRankData();
  }, [router]);

  useEffect(() => {
    const fetchPublicPortfolio = async () => {
      try {
        setPublicPortfolioLoading(true);
        const res = await fetch("/api/user/public-portfolio", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setPublicPortfolio(null);
          return;
        }
        const json = (await res.json()) as UserPublicPortfolioPayload;
        setPublicPortfolio(json);
      } catch (error) {
        console.error("Error fetching public portfolio:", error);
        setPublicPortfolio(null);
      } finally {
        setPublicPortfolioLoading(false);
      }
    };
    void fetchPublicPortfolio();
  }, [router]);

  useEffect(() => {
    const qrValue = publicPortfolio?.qrValue?.trim();
    if (!qrValue) {
      setPublicPortfolioQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const QR = await import("qrcode");
        const dataUrl = await QR.toDataURL(qrValue, {
          width: 140,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setPublicPortfolioQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setPublicPortfolioQrDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicPortfolio?.qrValue]);

  const stats = data ?? {
    totalAchievements: 0,
    points: 0,
    certificatesIssued: 0,
    pendingReviewCount: 0,
    recentPeriodCount: 0,
    participationCount: 0,
    lastAchievement: null,
    recentAchievements: [],
  };

  const recentAchievements = stats.recentAchievements;
  const publicUrl = useMemo(
    () => (publicPortfolio?.enabled ? publicPortfolio.publicUrl?.trim() || "" : ""),
    [publicPortfolio?.enabled, publicPortfolio?.publicUrl]
  );

  const handleCopyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 1500);
    } catch {
      setCopyDone(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مرحباً بك" : "Welcome"}
        subtitle={
          isAr ? "إليك نظرة سريعة على إنجازاتك" : "Here's a quick overview of your achievements"
        }
        actions={
          <>
            <Link
              href="/achievements/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{isAr ? "إضافة إنجاز" : "Add achievement"}</span>
            </Link>
            <Link
              href="/achievements"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              <FileBadge className="h-4 w-4" />
              <span>{isAr ? "عرض الشهادات" : "View certificates"}</span>
            </Link>
          </>
        }
      />

      {stats.lastAchievement ? (
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-text sm:px-5">
          <span className="font-semibold text-text">{isAr ? "آخر إنجاز" : "Latest achievement"}</span>
          <span className="mx-2 text-text-muted">·</span>
          <Link
            href={`/achievements/${stats.lastAchievement.id}`}
            className="font-medium text-primary hover:underline"
          >
            {stats.lastAchievement.title}
          </Link>
          {stats.lastAchievement.date ? (
            <span className="mt-1 block text-xs text-text-muted sm:mt-0 sm:ms-2 sm:inline">
              {new Date(stats.lastAchievement.date).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title={isAr ? "إجمالي الإنجازات" : "Total achievements"}
          value={stats.totalAchievements}
          icon={Trophy}
        />
        <StatCard title={isAr ? "النقاط" : "Points"} value={stats.points} icon={Star} />
        <StatCard
          title={isAr ? "شهادة صادرة" : "Certificates issued"}
          value={stats.certificatesIssued}
          icon={Award}
        />
        <StatCard
          title={isAr ? "قيد المراجعة" : "Under review"}
          value={stats.pendingReviewCount}
          icon={ClipboardList}
        />
        <StatCard
          title={isAr ? "إنجازات حديثة (٣٠ يومًا)" : "Recent (30 days)"}
          value={stats.recentPeriodCount}
          icon={Clock}
        />
      </div>

      <SectionCard className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-text">{isAr ? "إحصاءات الترتيب" : "Ranking stats"}</h2>
        {rankLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-16 animate-pulse rounded-lg border border-gray-100 bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-text-light">{isAr ? "مجموع النقاط" : "Total Points"}</p>
              <p className="mt-1 text-lg font-bold text-text">{rankData?.totalPoints ?? stats.points ?? 0}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-text-light">{isAr ? "ترتيبك" : "Your Rank"}</p>
              <p className="mt-1 text-lg font-bold text-text">
                {rankData?.rank ? `#${rankData.rank}` : isAr ? "غير مصنف بعد" : "Not ranked yet"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-text-light">
                {isAr ? "عدد الإنجازات المعتمدة" : "Approved Achievements"}
              </p>
              <p className="mt-1 text-lg font-bold text-text">{rankData?.achievementsCount ?? 0}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-text-light">{isAr ? "إجمالي الطلاب المصنفين" : "Total Ranked Students"}</p>
              <p className="mt-1 text-lg font-bold text-text">{rankData?.totalRankedStudents ?? 0}</p>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-text">
              {isAr ? "أحدث الإنجازات" : "Recent achievements"}
            </h2>
            <Link
              href="/achievements"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              {isAr ? "عرض الكل" : "View all"}
            </Link>
          </div>

          {!isLoading && recentAchievements.length > 0 ? (
            <div className="space-y-3">
              {recentAchievements.map((achievement) => (
                <Link
                  key={achievement.id}
                  href={`/achievements/${achievement.id}`}
                  className="block rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text">{achievement.title}</h3>
                        {(achievement.featured || achievement.isFeatured) && (
                          <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-medium text-secondary">
                            {isAr ? "مميز" : "Featured"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-text-light">{achievement.categoryLabel}</p>
                      {achievement.levelLabel ? (
                        <p className="mt-1 text-xs font-medium text-text">
                          {isAr ? "المستوى: " : "Level: "}
                          {achievement.levelLabel}
                        </p>
                      ) : null}
                      {achievement.scoreShort && achievement.scoreShort !== "—" ? (
                        <p className="mt-0.5 text-xs font-semibold text-amber-700">
                          ⭐ {achievement.scoreShort} {isAr ? "نقطة" : "pts"}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <span>
                          {achievement.date
                            ? new Date(achievement.date).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                        <AchievementStatusBadge
                          status={achievement.workflowStatus as WorkflowDisplayStatus}
                          locale={isAr ? "ar" : "en"}
                        />
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                            achievement.certificateStatus === "issued"
                              ? "bg-emerald-100 text-emerald-900"
                              : achievement.certificateStatus === "revoked"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {achievement.certificateLabel}
                        </span>
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : !isLoading && recentAchievements.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title={isAr ? "لا توجد إنجازات بعد" : "No achievements yet"}
              description={isAr ? "ابدأ بإضافة إنجازك الأول" : "Start by adding your first achievement"}
              action={
                <Link
                  href="/achievements/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>{isAr ? "إضافة إنجاز" : "Add achievement"}</span>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg border border-gray-100 bg-gray-100"
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <h2 className="mb-4 text-xl font-bold text-text">
            {isAr ? "إجراءات سريعة" : "Quick actions"}
          </h2>
          <div className="space-y-3">
            <Link
              href="/achievements/new"
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <PlusCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text">{isAr ? "إضافة إنجاز" : "Add achievement"}</h3>
                <p className="text-sm text-text-light">
                  {isAr ? "سجّل إنجازًا جديدًا مع الإثبات والتفاصيل" : "Record a new achievement with details"}
                </p>
              </div>
            </Link>

            <Link
              href="/achievements"
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileBadge className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text">{isAr ? "عرض الشهادات" : "View certificates"}</h3>
                <p className="text-sm text-text-light">
                  {isAr
                    ? "استعرض إنجازاتك وافتح الشهادات الصادرة"
                    : "Browse achievements and open issued certificates"}
                </p>
              </div>
            </Link>

            <Link
              href="/achievements"
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text">
                  {isAr ? "عرض جميع الإنجازات" : "View all achievements"}
                </h3>
                <p className="text-sm text-text-light">
                  {isAr ? "قائمة كاملة مع التصفية والحالة" : "Full list with status and filters"}
                </p>
              </div>
            </Link>

            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text">{isAr ? "الملف الشخصي" : "Profile"}</h3>
                <p className="text-sm text-text-light">
                  {isAr ? "عرض وتعديل ملفك الشخصي" : "View and edit your profile"}
                </p>
              </div>
            </Link>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <QrCode className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text">
                    {isAr ? "ملف الإنجاز العام" : "Public portfolio"}
                  </h3>
                  <p className="text-sm text-text-light">
                    {isAr
                      ? "الحصول على رابط الملف العام ورمز QR للمشاركة"
                      : "Get your public portfolio link and QR code"}
                  </p>
                </div>
              </div>

              {publicPortfolioLoading ? (
                <p className="mt-3 text-xs text-text-muted">{isAr ? "جاري التحميل..." : "Loading..."}</p>
              ) : !publicPortfolio?.enabled || !publicUrl ? (
                <p className="mt-3 text-xs text-amber-700">
                  {isAr
                    ? "الملف العام غير متاح حاليًا. يمكنك التحقق من صفحة الملف الشخصي."
                    : "Public portfolio is currently unavailable. Check your profile page."}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-[11px] text-text-muted" dir="ltr">
                    {publicUrl}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
                    >
                      <Link2 className="h-4 w-4" />
                      {isAr ? "فتح الرابط" : "Open link"}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleCopyPublicUrl()}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-gray-50"
                    >
                      <Copy className="h-4 w-4" />
                      {copyDone ? (isAr ? "تم النسخ" : "Copied") : isAr ? "نسخ الرابط" : "Copy link"}
                    </button>
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <QrCode className="h-4 w-4" />
                      {isAr ? "إدارة الملف" : "Manage portfolio"}
                    </Link>
                  </div>

                  {publicPortfolioQrDataUrl ? (
                    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={publicPortfolioQrDataUrl}
                        alt={isAr ? "رمز QR لملف الإنجاز العام" : "QR code for public portfolio"}
                        width={120}
                        height={120}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
};

export default DashboardPage;
