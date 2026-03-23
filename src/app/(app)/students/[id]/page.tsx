"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import { getLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import type { StudentHallProfilePayload } from "@/lib/hall-of-fame-service";
import StudentHallAchievementCard from "@/components/hall-of-fame/StudentHallAchievementCard";
import { hallTierBadgeClass } from "@/lib/hall-of-fame-level";
import { ChevronRight, Loader2, Sparkles, User } from "lucide-react";

const StudentHallProfilePage = () => {
  const params = useParams();
  const id = String(params?.id ?? "");
  const locale = getLocale();
  const isAr = locale === "ar";
  const t = getTranslation(locale).hallOfFamePage;

  const [data, setData] = useState<StudentHallProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [id]);

  useEffect(() => {
    const load = async () => {
      if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/students/${id}/hall-profile?locale=${locale}`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          setData(null);
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setData(null);
          setNotFound(true);
          return;
        }
        const json = (await res.json()) as StudentHallProfilePayload;
        setData(json);
        setNotFound(false);
      } catch {
        setNotFound(true);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, locale]);

  const trimmed = data?.student.photo?.trim() ?? "";
  const showAvatar =
    Boolean(trimmed) &&
    !avatarFailed &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://"));
  const unopt =
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://");

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-text-light">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <span>{t.loading}</span>
        </div>
      </PageContainer>
    );
  }

  if (notFound || !data) {
    return (
      <PageContainer>
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-text">
            {isAr ? "تعذر العثور على الطالب." : "Student not found."}
          </p>
          <Link
            href="/hall-of-fame"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            <ChevronRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
            {t.backToHall}
          </Link>
        </div>
      </PageContainer>
    );
  }

  const s = data.student;
  const badge = hallTierBadgeClass(s.highestTier);

  return (
    <PageContainer>
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-text-light">
        <Link href="/" className="hover:text-primary">
          {isAr ? "الرئيسية" : "Home"}
        </Link>
        <span aria-hidden>/</span>
        <Link href="/hall-of-fame" className="hover:text-primary">
          {isAr ? "لوحة التميز" : "Hall of Fame"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-text">{s.name}</span>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg">
        <div className="bg-gradient-to-l from-primary/15 via-white to-white px-6 py-8 sm:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 shadow-inner">
              {showAvatar ? (
                <Image
                  src={trimmed}
                  alt={s.name}
                  fill
                  unoptimized={unopt}
                  className="object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10">
                  <User className="h-12 w-12 text-primary/50" aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{t.studentProfile}</p>
              <h1 className="text-3xl font-black tracking-tight text-text sm:text-4xl">{s.name}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-text-light">
                <span>{s.gradeLabel}</span>
                <span aria-hidden>·</span>
                <span>{s.stageLabel}</span>
                <span aria-hidden>·</span>
                <span>
                  {isAr ? "الإنجازات" : "Achievements"}: {s.totalAchievements}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${badge}`}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {s.highestTierLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <h2 className="mb-6 text-xl font-bold text-text">{t.achievementsHeading}</h2>
        {data.sections.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-10 text-center text-text-light">
            {t.noAchievements}
          </p>
        ) : (
          <div className="space-y-10">
            {data.sections.map((sec) => (
              <div key={sec.key}>
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-text">
                  <span className="h-1 w-8 rounded-full bg-primary/80" aria-hidden />
                  {sec.title}
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  {sec.items.map((card) => (
                    <StudentHallAchievementCard key={card.id} card={card} isAr={isAr} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <Link
          href="/hall-of-fame"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ChevronRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
          {t.backToHall}
        </Link>
      </div>
    </PageContainer>
  );
};

export default StudentHallProfilePage;
