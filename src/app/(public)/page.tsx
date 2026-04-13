"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import InstitutionalSection from "@/components/landing/InstitutionalSection";
import PlatformFeaturedStrip from "@/components/landing/PlatformFeaturedStrip";
import {
  categories,
} from "@/data/landing-content";
import { DEFAULT_HOME_HIGHLIGHTS } from "@/lib/home-highlights";
import { getLocale } from "@/lib/i18n";
import {
  Upload,
  Trophy,
  Medal,
  Award as AwardIcon,
  Check,
  CalendarDays,
  Users,
  FileText,
  Target,
  Star,
  Globe,
  Eye,
  Lightbulb,
  Newspaper,
} from "lucide-react";
import Link from "next/link";
import PlatformLogo from "@/components/branding/PlatformLogo";
import SafeLocalImage from "@/components/media/SafeLocalImage";
import { PUBLIC_IMG } from "@/lib/publicImages";
import InstitutionalAchievementCard from "@/components/landing/InstitutionalAchievementCard";
import type { HomeHighlightBlockPayload, HomeHighlightItemPayload } from "@/lib/home-highlights";
import { DEFAULT_HOME_PAGE_CONTENT, type HomePageContentPayload } from "@/lib/home-page-content";
import { getAchievementEventOrSlugLabel, getAchievementTypeLabel } from "@/lib/achievement-display-labels";

const HOME_HIGHLIGHTS_STATIC_DEFAULT = DEFAULT_HOME_HIGHLIGHTS;

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-[#071a3d]">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PUBLIC_IMG.mainHero}
          alt="خلفية رئيسية — منصة تميز الأنجال"
          className="h-full w-full object-cover object-center"
          loading="eager"
          fetchPriority="high"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,26,61,0.95)_0%,rgba(7,26,61,0.88)_38%,rgba(7,26,61,0.58)_68%,rgba(7,26,61,0.25)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.22),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.16),transparent_24%)]" />

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url('${PUBLIC_IMG.pattern}')`,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/95 backdrop-blur">
              منصة تميز الأنجال
            </div>

            <h1 className="mt-6 text-[2.4rem] font-extrabold leading-[1.3] tracking-normal text-white sm:text-5xl sm:leading-[1.22] lg:text-7xl lg:leading-[1.12]">
              سجّل إنجازك وابدأ رحلتك نحو التميز
            </h1>

            <p className="mt-6 max-w-2xl text-base font-normal leading-relaxed text-white/90 sm:text-lg">
              ارفع إنجازاتك، وشاركها مع مجتمعك التعليمي، واحصل على فرص التكريم في
              حفل التميّز للطلاب، واستفد من المنصة في توثيق إنجازاتك وتعزيز فرصك
              في التسجيل في الجامعات المحلية والعالمية.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-[#d4af37] px-8 py-4 text-base font-bold text-[#071a3d] transition hover:bg-[#e5be4a]"
              >
                ابدأ الآن
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <PlatformLogo variant="white" size={192} priority />
          </div>
        </div>
      </div>
    </section>
  );
};

const VisionMissionSection = ({ content }: { content: HomePageContentPayload }) => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const visionText = isAr ? content.visionAr : content.visionEn;
  const missionText = isAr ? content.missionAr : content.missionEn;

  return (
    <section id="vision-mission" className="bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold leading-tight tracking-tight text-slate-950 md:text-4xl">
            رؤيتنا - رسالتنا
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold leading-snug tracking-tight text-primary">الرؤية</h3>
              </div>
              <p className="text-lg leading-relaxed text-slate-700">
                {visionText}
              </p>
            </div>

            <div className="rounded-2xl border border-secondary/20 bg-gradient-to-br from-secondary/10 to-secondary/5 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                  <Lightbulb className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-bold leading-snug tracking-tight text-secondary">الرسالة</h3>
              </div>
              <p className="text-lg leading-relaxed text-slate-700">
                {missionText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const QuickActionTiles = () => {
  const updatedActions = [
    {
      id: "1",
      title: "شارك إنجازك",
      description: "سجّل إنجازك الجديد وشاركه مع المجتمع التعليمي",
      href: "/achievements/new",
      icon: Upload,
    },
    {
      id: "2",
      title: "استكشف الإنجازات المعتمدة",
      description: "اطّلع على الإنجازات المعتمدة والموثقة في المنصة",
      href: "/achievements?approved=true",
      icon: Trophy,
    },
    {
      id: "3",
      title: "تعرّف على مجالات الإنجاز",
      description: "اكتشف المجالات المختلفة التي يمكنك المشاركة فيها",
      href: "/categories",
      icon: Medal,
    },
  ];

  return (
    <section className="bg-background-soft py-16">
      <div className="container mx-auto px-4">
        <div className="grid gap-6 md:grid-cols-3">
          {updatedActions.map((action) => {
            const IconComponent = action.icon;

            return (
              <a
                key={action.id}
                href={action.href}
                className="group rounded-xl border border-gray-100 bg-white p-8 shadow-md transition-all duration-300 hover:border-primary hover:shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary">
                    <IconComponent className="h-8 w-8 text-primary transition-colors group-hover:text-white" />
                  </div>

                  <h3 className="text-xl font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-primary">
                    {action.title}
                  </h3>

                  <p className="font-normal leading-relaxed text-text-light">
                    {action.description}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const WhyShareSection = () => {
  const benefits = [
    "توثيق رسمي لإنجازاتك",
    "فرصة للترشيح لمسابقات التميّز",
    "دخول في برامج التكريم المدرسي",
    "تعزيز ملفك الأكاديمي",
    "الظهور ضمن الطلاب المتميزين في المنصة",
  ];

  return (
    <section id="why-share" className="bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-bold leading-tight tracking-tight text-text md:text-4xl">
            لماذا تشارك إنجازك؟
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-xl border border-gray-100 bg-background-soft p-6 shadow-md transition-all duration-200 hover:border-primary"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <p className="pt-1 text-lg font-medium leading-relaxed text-text">
                  {benefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CategoryChipsSection = () => {
  return (
    <section id="achievement-fields" className="bg-background-soft py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-text md:text-4xl md:leading-tight">
            مجالات الإنجاز
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-text-light">
            استكشف الإنجازات المتميزة عبر مختلف المجالات التعليمية والتربوية
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/categories/${category.id}`}
              className="rounded-full border border-[#1e3a8a] bg-[#21409a] px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 hover:bg-[#1a327a] hover:shadow-lg"
            >
              {category.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

const EventAnnouncement = ({ content }: { content: HomePageContentPayload }) => {
  const locale = getLocale();
  const isAr = locale === "ar";

  const ceremonyTitle = isAr
    ? content.ceremonyTitleAr || DEFAULT_HOME_PAGE_CONTENT.ceremonyTitleAr
    : content.ceremonyTitleEn || DEFAULT_HOME_PAGE_CONTENT.ceremonyTitleEn;
  const ceremonyDescription = isAr
    ? content.ceremonyDescriptionAr || DEFAULT_HOME_PAGE_CONTENT.ceremonyDescriptionAr
    : content.ceremonyDescriptionEn || DEFAULT_HOME_PAGE_CONTENT.ceremonyDescriptionEn;
  const ceremonySubtitle = isAr
    ? content.ceremonySubtitleAr || DEFAULT_HOME_PAGE_CONTENT.ceremonySubtitleAr
    : content.ceremonySubtitleEn || DEFAULT_HOME_PAGE_CONTENT.ceremonySubtitleEn;
  const ceremonyInvitationText = isAr
    ? content.ceremonyInvitationAwardsAr || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationAwardsAr
    : content.ceremonyInvitationAwardsEn || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationAwardsEn;
  const ceremonyInvitationIntro = isAr
    ? content.ceremonyInvitationIntroAr || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationIntroAr
    : content.ceremonyInvitationIntroEn || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationIntroEn;
  const ceremonyInvitationDate = isAr
    ? content.ceremonyInvitationDateAr || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationDateAr
    : content.ceremonyInvitationDateEn || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationDateEn;
  const ceremonyInvitationVenue = isAr
    ? content.ceremonyInvitationVenueAr || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationVenueAr
    : content.ceremonyInvitationVenueEn || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationVenueEn;
  const ceremonyInvitationProgram = isAr
    ? content.ceremonyRecognitionItemsAr
    : content.ceremonyRecognitionItemsEn;
  const ceremonyInvitationClosing = isAr
    ? content.ceremonyInvitationClosingAr || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationClosingAr
    : content.ceremonyInvitationClosingEn || DEFAULT_HOME_PAGE_CONTENT.ceremonyInvitationClosingEn;

  return (
    <section id="award-ceremony" className="bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-2xl border-2 border-[#d4af37] bg-background-soft shadow-[0_20px_45px_rgba(7,26,61,0.22)] ring-2 ring-[#071a3d]/10">
            <div className="absolute end-5 top-4 rounded-full border border-[#d4af37]/60 bg-[#071a3d] px-3 py-1 text-xs font-bold text-[#f3cf63]">
              بطاقة دعوة
            </div>
            <div className="bg-gradient-to-r from-[#071a3d] to-[#1e3a8a] px-8 py-6">
              <div className="flex items-center justify-center gap-3">
                <Trophy className="h-10 w-10 text-[#d4af37]" />
                <h2 className="text-center text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl md:text-2xl">
                  {ceremonyTitle}
                </h2>
                <CalendarDays className="h-10 w-10 text-[#d4af37]" />
              </div>
            </div>

            <div className="p-8">
              <p className="mb-4 text-center text-base font-semibold text-[#071a3d]">{ceremonySubtitle}</p>
              <p className="mb-6 text-center text-lg leading-8 text-slate-800">
                {ceremonyDescription}
              </p>
              <p className="mb-6 text-center text-lg leading-8 text-slate-800">
                {ceremonyInvitationIntro}{" "}
                <span className="font-bold text-[#071a3d]">{ceremonyInvitationDate}</span> {ceremonyInvitationVenue}
              </p>

              <div className="mb-6 rounded-xl bg-slate-50 p-6">
                <h3 className="mb-4 text-xl font-bold text-[#071a3d]">
                  {isAr ? "ويشمل التكريم:" : "Recognition includes:"}
                </h3>
                <ul className="space-y-3 text-slate-700">
                  {ceremonyInvitationProgram.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="flex items-start gap-2 text-base leading-7 sm:text-lg"
                      dir={isAr ? "rtl" : "ltr"}
                    >
                      <Check className="mt-1 h-5 w-5 shrink-0 text-[#d4af37]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-[#071a3d] p-6 text-white">
                <p className="mb-2 text-lg font-bold">{isAr ? "كما سيتم تقديم:" : "Also included:"}</p>
                <p className="text-lg font-bold text-[#d4af37] sm:text-xl">
                  {ceremonyInvitationText}
                </p>
                <p className="mt-3 text-sm text-white/90">{ceremonyInvitationClosing}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const formatHomeStatNumber = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const StatisticsBar = () => {
  const [statsData, setStatsData] = useState({
    studentsCount: 0,
    achievementsCount: 0,
    fieldsCount: 0,
    awardsCount: 50,
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch("/api/public/home-stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          data?: {
            studentsCount?: number;
            achievementsCount?: number;
            fieldsCount?: number;
            awardsCount?: number;
          };
        };
        if (!mounted || !json?.ok || !json.data) return;
        setStatsData({
          studentsCount: Number(json.data.studentsCount || 0),
          achievementsCount: Number(json.data.achievementsCount || 0),
          fieldsCount: Number(json.data.fieldsCount || 0),
          awardsCount: 50,
        });
      } catch {
        // Keep zeros on failure.
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = [
    { value: formatHomeStatNumber(statsData.studentsCount), label: "عدد الطلاب المسجلين", icon: Users },
    { value: "50+", label: "عدد الجوائز المقدمة", icon: AwardIcon },
    { value: formatHomeStatNumber(statsData.achievementsCount), label: "عدد الإنجازات", icon: FileText },
    { value: formatHomeStatNumber(statsData.fieldsCount), label: "عدد مجالات الإنجاز المسجلة", icon: Target },
  ];

  return (
    <section className="border-y border-gray-200 bg-background-soft py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat) => {
            const IconComponent = stat.icon;

            return (
              <div key={stat.label} className="text-center">
                <div className="mb-3 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <IconComponent className="h-8 w-8 text-primary" />
                  </div>
                </div>

                <div
                  dir={stat.label === "عدد الجوائز المقدمة" ? "ltr" : undefined}
                  className="mb-2 text-3xl font-extrabold tabular-nums tracking-tight text-primary md:text-4xl"
                >
                  {stat.value}
                </div>

                <div className="text-sm font-medium text-slate-600 md:text-base">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const ParticipationNewsSection = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [sectionData, setSectionData] = useState(HOME_HIGHLIGHTS_STATIC_DEFAULT);

  const pickBi = (ar?: string, en?: string, legacy?: string) => {
    const a = String(ar || "").trim();
    const e = String(en || "").trim();
    const l = String(legacy || "").trim();
    if (isAr) return a || e || l || "—";
    return e || a || l || "—";
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch("/api/public/home-highlights", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          data?: typeof HOME_HIGHLIGHTS_STATIC_DEFAULT;
        };
        if (!mounted || !json?.ok || !json.data) return;
        setSectionData(json.data);
      } catch {
        // Keep static fallback.
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const participationBlocks = useMemo(() => {
    const raw =
      sectionData.participationBlocks && sectionData.participationBlocks.length > 0
        ? sectionData.participationBlocks
        : DEFAULT_HOME_HIGHLIGHTS.participationBlocks || [];
    return [...raw]
      .filter((b) => Array.isArray(b.items) && b.items.length > 0)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [sectionData.participationBlocks]);

  if (sectionData.participationSectionEnabled === false) return null;

  const resolveBlockIcon = (block: HomeHighlightBlockPayload) => {
    if (block.headerIconKey === "globe") return Globe;
    if (block.headerIconKey === "star") return Star;
    return block.color === "gold" ? Star : Globe;
  };

  const blockColumnClass = (color: HomeHighlightBlockPayload["color"]) =>
    color === "gold"
      ? "flex flex-col rounded-2xl bg-[#c5a021] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-amber-900/20 sm:p-6"
      : "flex flex-col rounded-2xl bg-[#1a2f66] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] ring-1 ring-white/10 sm:p-6";

  const articleClass = (color: HomeHighlightBlockPayload["color"]) =>
    color === "gold"
      ? "flex w-full flex-col overflow-hidden rounded-2xl border border-amber-900/30 bg-[#a88f18]/50 p-4 shadow-[0_4px_14px_rgba(0,0,0,0.12)] sm:p-5"
      : "flex w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-[#253b71] p-4 shadow-[0_4px_14px_rgba(0,0,0,0.18)] sm:p-5";

  const blockTitleClass = (color: HomeHighlightBlockPayload["color"]) =>
    color === "gold"
      ? "text-xl font-bold leading-snug tracking-tight text-slate-900"
      : "text-xl font-bold leading-snug tracking-tight text-white";

  const itemTitleClass = (color: HomeHighlightBlockPayload["color"]) =>
    color === "gold"
      ? "text-lg font-bold leading-snug tracking-tight text-slate-900"
      : "text-lg font-bold leading-snug tracking-tight text-white";

  const itemDescClass = (color: HomeHighlightBlockPayload["color"]) =>
    color === "gold"
      ? "text-sm leading-relaxed text-slate-800/90"
      : "text-sm leading-relaxed text-blue-100/85";

  const headerIconClass = (color: HomeHighlightBlockPayload["color"]) =>
    color === "gold" ? "h-7 w-7 shrink-0 text-slate-900" : "h-7 w-7 shrink-0 text-[#d4af37]";

  return (
    <section className="border-y border-gray-200 bg-[#eceff3] py-12">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center md:mb-12">
          <h2 className="text-2xl font-bold leading-[1.2] tracking-tight text-slate-950 md:text-3xl">
            {pickBi(
              sectionData.participationTitleAr,
              sectionData.participationTitleEn,
              DEFAULT_HOME_HIGHLIGHTS.participationTitleAr
            )}
          </h2>
          <p className="text-base leading-relaxed text-gray-600">
            {pickBi(
              sectionData.participationSubtitleAr,
              sectionData.participationSubtitleEn,
              DEFAULT_HOME_HIGHLIGHTS.participationSubtitleAr
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          {participationBlocks.map((block, blockIdx) => {
            const Icon = resolveBlockIcon(block);
            const items = (block.items || [])
              .filter((item) => item?.isActive !== false)
              .sort((a, b) => (a.order || 0) - (b.order || 0)) as HomeHighlightItemPayload[];
            return (
              <div
                key={`${block.titleAr || block.titleEn || block.title}-${blockIdx}`}
                className={blockColumnClass(block.color)}
              >
                <div className="mb-5 flex items-center gap-2 text-start sm:mb-6">
                  <Icon className={headerIconClass(block.color)} strokeWidth={2} aria-hidden />
                  <h3 className={blockTitleClass(block.color)}>
                    {pickBi(block.titleAr, block.titleEn, block.title)}
                  </h3>
                </div>
                <div className="flex flex-1 flex-col gap-5 md:gap-6">
                  {items.map((item, idx) => (
                    <article
                      key={`${item.titleAr || item.titleEn || item.title}-${idx}`}
                      className={articleClass(block.color)}
                    >
                      <div className="relative isolate aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-black/10">
                        <SafeLocalImage
                          src={item.imageUrl || PUBLIC_IMG.achieveFile}
                          alt={pickBi(item.titleAr, item.titleEn, item.title)}
                          fill
                          objectFit="cover"
                          className="object-cover object-center"
                          fallback={<div className="absolute inset-0 bg-black/10" aria-hidden />}
                        />
                      </div>
                      <div className="mt-4 space-y-2 text-start">
                        <h4 className={itemTitleClass(block.color)}>
                          {pickBi(item.titleAr, item.titleEn, item.title)}
                        </h4>
                        <p className={itemDescClass(block.color)}>
                          {pickBi(item.descriptionAr, item.descriptionEn, item.description)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const TopAchievementsSection = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [sectionData, setSectionData] = useState(HOME_HIGHLIGHTS_STATIC_DEFAULT);

  const pickBi = (ar?: string, en?: string, legacy?: string) => {
    const a = String(ar || "").trim();
    const e = String(en || "").trim();
    const l = String(legacy || "").trim();
    if (isAr) return a || e || l || "—";
    return e || a || l || "—";
  };

  const resolveHighlightBadge = (item: HomeHighlightItemPayload): string => {
    const loc = isAr ? "ar" : "en";
    const badgeAr = String(item.badgeAr || "").trim();
    const badgeEn = String(item.badgeEn || "").trim();
    const fromBadge = isAr ? badgeAr || badgeEn : badgeEn || badgeAr;
    if (fromBadge) return fromBadge;
    const t = String(item.type || "").trim();
    if (!t) return "—";
    const typeL = getAchievementTypeLabel(t, loc);
    const ns = loc === "ar" ? "غير محدد" : "Not specified";
    if (typeL && typeL !== ns && typeL !== "—") return typeL;
    return getAchievementEventOrSlugLabel(t, loc);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch("/api/public/home-highlights", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok?: boolean;
          data?: typeof HOME_HIGHLIGHTS_STATIC_DEFAULT;
        };
        if (!mounted || !json?.ok || !json.data) return;
        setSectionData(json.data);
      } catch {
        // Keep static fallback silently.
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => {
    const all = (sectionData.blocks || [])
      .flatMap((b) => (Array.isArray(b.items) ? b.items : []))
      .filter((item) => item?.isActive !== false) as HomeHighlightItemPayload[];
    return all.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [sectionData.blocks]);

  return (
    <section id="featured-achievements" className="border-t border-slate-200/80 bg-gray-50 py-16 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center md:mb-12">
          <h2 className="text-2xl font-bold leading-[1.2] tracking-tight text-slate-950 md:text-3xl">
            {pickBi(sectionData.sectionTitleAr, sectionData.sectionTitleEn, sectionData.sectionTitle)}
          </h2>
          <p className="text-base leading-relaxed text-gray-600">
            {pickBi(
              sectionData.sectionSubtitleAr,
              sectionData.sectionSubtitleEn,
              sectionData.sectionSubtitle
            )}
          </p>
        </div>

        {sectionData.sectionEnabled === false ? null : (
          <div
            className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
              sectionData.layoutColumns === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3"
            }`}
          >
          {items.map((item, idx) => (
            <InstitutionalAchievementCard
              key={`${item.titleAr || item.titleEn || item.title}-${idx}`}
              iconKey={item.iconKey || "star"}
              title={pickBi(item.titleAr, item.titleEn, item.title)}
              description={pickBi(item.descriptionAr, item.descriptionEn, item.description)}
              badge={resolveHighlightBadge(item)}
            />
          ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default function Home() {
  const [homePageContent, setHomePageContent] = useState<HomePageContentPayload>(DEFAULT_HOME_PAGE_CONTENT);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const ceremonyRes = await fetch("/api/public/home-ceremony", { cache: "no-store" });
        if (!ceremonyRes.ok) return;
        const ceremonyJson = (await ceremonyRes.json()) as { ok?: boolean; data?: Partial<HomePageContentPayload> };
        if (!mounted || !ceremonyJson?.ok || !ceremonyJson.data) return;
        setHomePageContent((prev) => ({ ...prev, ...ceremonyJson.data }));
      } catch {
        // Keep defaults silently.
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <HeroSection />
      <VisionMissionSection content={homePageContent} />
      <QuickActionTiles />
      <WhyShareSection />
      <CategoryChipsSection />
      <EventAnnouncement content={homePageContent} />
      <StatisticsBar />
      <ParticipationNewsSection />
      <TopAchievementsSection />
      <PlatformFeaturedStrip />
      <InstitutionalSection />
    </div>
  );
}