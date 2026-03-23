"use client";

import type { ReactNode } from "react";
import InstitutionalSection from "@/components/landing/InstitutionalSection";
import PlatformFeaturedStrip from "@/components/landing/PlatformFeaturedStrip";
import { recognitions, categories } from "@/data/landing-content";
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
} from "lucide-react";
import Link from "next/link";
import PlatformLogo from "@/components/branding/PlatformLogo";
import SafeLocalImage from "@/components/media/SafeLocalImage";
import { PUBLIC_IMG } from "@/lib/publicImages";

const heroImageFallback = <div className="absolute inset-0 bg-[#071a3d]" aria-hidden />;

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-[#071a3d]">
      <div className="absolute inset-0">
        <SafeLocalImage
          src={PUBLIC_IMG.mainHero}
          alt="خلفية رئيسية — منصة تميز الأنجال"
          fill
          priority
          sizes="100vw"
          objectFit="cover"
          className="object-center"
          fallback={heroImageFallback}
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
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
              منصة تميز الأنجال
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-7xl">
              سجّل إنجازك وابدأ رحلتك نحو التميز
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 sm:text-lg">
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

const VisionMissionSection = () => {
  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-black text-slate-950 md:text-4xl">
            رؤيتنا - رسالتنا
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-black text-primary">الرؤية</h3>
              </div>
              <p className="text-lg leading-relaxed text-slate-700">
                إبراز تميز طلاب مدارس الأنجال وتوثيق إنجازاتهم في منصة تربوية
                حديثة تدعم التنافس الإيجابي والتميز الأكاديمي والمهاري.
              </p>
            </div>

            <div className="rounded-2xl border border-secondary/20 bg-gradient-to-br from-secondary/10 to-secondary/5 p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                  <Lightbulb className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-black text-secondary">الرسالة</h3>
              </div>
              <p className="text-lg leading-relaxed text-slate-700">
                توفير بيئة رقمية موثوقة لتسجيل الإنجازات المعتمدة، وتحفيز الطلاب
                على المشاركة، وتعزيز فرص التكريم والظهور المشرف محليًا وعالميًا.
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
      href: "/submit",
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

                  <h3 className="text-xl font-bold text-text transition-colors group-hover:text-primary">
                    {action.title}
                  </h3>

                  <p className="leading-relaxed text-text-light">
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
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-black text-text md:text-4xl">
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
    <section className="bg-background-soft py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-text md:text-4xl">
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
              className="rounded-full border border-gray-200 bg-white px-6 py-3 font-semibold text-text shadow-md transition-all duration-200 hover:scale-105 hover:border-primary hover:text-primary hover:shadow-lg"
            >
              {category.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

const EventAnnouncement = () => {
  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-2xl border-t-4 border-[#d4af37] bg-background-soft shadow-xl">
            <div className="bg-gradient-to-r from-[#071a3d] to-[#1e3a8a] px-8 py-6">
              <div className="flex items-center justify-center gap-3">
                <Trophy className="h-10 w-10 text-[#d4af37]" />
                <h2 className="text-center text-xl font-black text-white sm:text-2xl md:text-2xl">
                  حفل تكريم الطلاب والطالبات المحققين أعلى الإنجازات
                </h2>
                <CalendarDays className="h-10 w-10 text-[#d4af37]" />
              </div>
            </div>

            <div className="p-8">
              <p className="mb-6 text-center text-lg leading-8 text-slate-800">
                تدعو مدارس الأنجال الأهلية طلابها إلى رفع إنجازاتهم في المنصة
                استعدادًا لحفل تكريم الإنجازات الطلابية، والذي سيقام يوم{" "}
                <span className="font-bold text-[#071a3d]">
                  الأربعاء 3 / 6 / 2026م
                </span>{" "}
                على مسرح مدارس الأنجال.
              </p>

              <div className="mb-6 rounded-xl bg-slate-50 p-6">
                <h3 className="mb-4 text-xl font-bold text-[#071a3d]">
                  ويشمل التكريم:
                </h3>

                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#d4af37]" />
                    <span>الطلاب المحققين لإنجازات على مستوى المملكة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#d4af37]" />
                    <span>الطلاب المحققين لإنجازات على مستوى العالم</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#d4af37]" />
                    <span>
                      الطلاب الحاصلين على 99٪ إلى 100٪ في اختبار القدرات
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#d4af37]" />
                    <span>
                      الطلاب المشاركين في مسابقات على مستوى المملكة أو على مستوى
                      العالم
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl bg-[#071a3d] p-6 text-white">
                <p className="mb-2 text-lg font-bold">كما سيتم تقديم:</p>
                <p className="text-lg font-black text-[#d4af37] sm:text-xl">
                  3 جوائز قيمة للطلاب المحققين تنوعًا في الإنجازات والحاصلين على أعلى النقاط
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const StatisticsBar = () => {
  const stats = [
    { value: "200+", label: "عدد الطلاب المسجلين", icon: Users },
    { value: "60+", label: "عدد الجوائز المقدمة", icon: AwardIcon },
    { value: "500+", label: "عدد الإنجازات", icon: FileText },
    { value: "12", label: "عدد مجالات الإنجاز", icon: Target },
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

                <div className="mb-2 text-3xl font-black text-primary md:text-4xl">
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

const RecognitionStrip = () => {
  const limitedRecognitions = recognitions.slice(0, 6);

  return (
    <section className="border-y border-gray-200 bg-white py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-text md:text-3xl">
            مشاركات طلاب وطالبات مدارس الأنجال بالمعارض والمسابقات المحلية
            والعالمية
          </h2>
          <p className="text-text-light">
            إنجازات طلاب مدارس الأنجال الأهلية في المحافل المحلية والعالمية
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {limitedRecognitions.map((recognition) => (
            <div
              key={recognition.id}
              className="rounded-full bg-gradient-to-r from-primary to-primary-dark px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg md:text-base"
            >
              {recognition.name}
            </div>
          ))}

          <Link
            href="/competitions"
            className="rounded-full border-2 border-primary bg-white px-6 py-3 text-sm font-semibold text-primary shadow-md transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-white hover:shadow-lg md:text-base"
          >
            عرض المزيد
          </Link>
        </div>
      </div>
    </section>
  );
};

/** بطاقة إنجاز كالمرجع: صورة أعلى، عنوان وعنوان فرعي أسفلها (بدون تغطية على الصورة) */
type ReferenceAchievementCardProps = {
  variant: "gold" | "blue";
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
  fallbackIcon: ReactNode;
};

const ReferenceAchievementCard = ({
  variant,
  imageSrc,
  imageAlt,
  title,
  description,
  fallbackIcon,
}: ReferenceAchievementCardProps) => {
  const shell =
    variant === "blue"
      ? "border border-white/20 bg-[#253b71] shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
      : "border border-amber-900/30 bg-[#a88f18]/50 shadow-[0_4px_14px_rgba(0,0,0,0.12)]";

  return (
    <article
      className={`flex w-full flex-col overflow-hidden rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5 sm:p-5 ${shell}`}
    >
      <div className="relative isolate aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-black/10">
        <SafeLocalImage
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          objectFit="cover"
          className="object-cover object-center"
          fallback={
            <div
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/10"
              role="img"
              aria-hidden
            >
              {fallbackIcon}
            </div>
          }
        />
      </div>
      <div className="mt-4 space-y-2 text-start">
        {variant === "blue" ? (
          <>
            <h4 className="text-lg font-bold leading-snug text-white">{title}</h4>
            <p className="text-sm leading-relaxed text-blue-100/85">{description}</p>
          </>
        ) : (
          <>
            <h4 className="text-lg font-bold leading-snug text-slate-900">{title}</h4>
            <p className="text-sm leading-relaxed text-slate-800/90">{description}</p>
          </>
        )}
      </div>
    </article>
  );
};

const TopAchievementsSection = () => {
  const weeklySpotlight = {
    title: "الإنجاز الأسبوعي",
    achievements: [
      {
        title: "قصة إنجاز ملهمة",
        description:
          "حصول الطالب/ عبدالله السحيب على الميدالية البرونزية في ملتقى الربيع 2025م المقام بمدينة الرياض تخصص فيزياء للتدريبات على الأولمبياد الدولية 2025م",
      },
      {
        title: "ملفات إنجاز حديثة",
        description: "إبراز قصص النجاح بأسلوب عرض بصري حديث ومؤثر",
        image: PUBLIC_IMG.achieveFile,
        alt: "ملفات إنجاز حديثة",
        objectFit: "contain" as const,
      },
    ],
  };

  const globalAchievements = {
    title: "الإنجازات العالمية",
    achievements: [
      {
        title: "مشاركة عالمية في ISEF",
        description: "تمثيل مشرف لطلاب مدارس الأنجال في المحافل الدولية",
        image: PUBLIC_IMG.isef,
        alt: "مشاركة عالمية في معرض ISEF",
        objectFit: "cover" as const,
      },
      {
        title: "تمثيل المملكة دوليًا",
        description: "إنجازات طلابية ترفع راية الوطن في المحافل الدولية",
        image: PUBLIC_IMG.saudiFlag,
        alt: "تمثيل المملكة العربية السعودية دوليًا",
        objectFit: "cover" as const,
      },
    ],
  };

  const weeklyStory = weeklySpotlight.achievements[0];
  const recentFiles = weeklySpotlight.achievements[1] as {
    title: string;
    description: string;
    image: string;
    alt: string;
    objectFit: "cover" | "contain";
  };

  return (
    <section className="border-t border-slate-200/80 bg-gray-50 py-16 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center md:mb-12">
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 md:text-3xl">
            إبراز النماذج المتميزة والإنجازات البارزة
          </h2>
          <p className="text-base leading-relaxed text-gray-600">
            واجهة مؤسسية تبرز أثر المدرسة في صناعة التميز
          </p>
        </div>

        {/* عمودان كالمرجع: ذهبي | أزرق — في RTL العمود الأول يمين (ذهبي)، الثاني يسار (أزرق) */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          {/* عمود الإنجاز الأسبوعي — خلفية ذهبية كالمرجع */}
          <div className="flex flex-col rounded-2xl bg-[#c5a021] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-amber-900/20 sm:p-6">
            <div className="mb-5 flex items-center gap-2 text-start sm:mb-6">
              <Star className="h-7 w-7 shrink-0 text-slate-900" strokeWidth={2} aria-hidden />
              <h3 className="text-xl font-bold text-slate-900">{weeklySpotlight.title}</h3>
            </div>
            <div className="flex flex-1 flex-col gap-5 md:gap-6">
              <ReferenceAchievementCard
                variant="gold"
                imageSrc={PUBLIC_IMG.achieveWeeklySection}
                imageAlt="الإنجاز الأسبوعي — منصة تميز الأنجال"
                title={weeklyStory.title}
                description={weeklyStory.description}
                fallbackIcon={<Star className="h-12 w-12 text-amber-900/25" aria-hidden />}
              />
              <ReferenceAchievementCard
                variant="gold"
                imageSrc={recentFiles.image}
                imageAlt={recentFiles.alt}
                title={recentFiles.title}
                description={recentFiles.description}
                fallbackIcon={<FileText className="h-12 w-12 text-amber-900/25" aria-hidden />}
              />
            </div>
          </div>

          {/* عمود الإنجازات العالمية — خلفية كحلي كالمرجع */}
          <div className="flex flex-col rounded-2xl bg-[#1a2b56] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] ring-1 ring-white/10 sm:p-6">
            <div className="mb-5 flex items-center gap-2 text-start sm:mb-6">
              <Globe className="h-7 w-7 shrink-0 text-[#d4af37]" strokeWidth={2} aria-hidden />
              <h3 className="text-xl font-bold text-white">{globalAchievements.title}</h3>
            </div>
            <div className="flex flex-1 flex-col gap-5 md:gap-6">
              <ReferenceAchievementCard
                variant="blue"
                imageSrc={globalAchievements.achievements[0].image}
                imageAlt={globalAchievements.achievements[0].alt}
                title={globalAchievements.achievements[0].title}
                description={globalAchievements.achievements[0].description}
                fallbackIcon={<Globe className="h-12 w-12 text-white/25" aria-hidden />}
              />
              <ReferenceAchievementCard
                variant="blue"
                imageSrc={globalAchievements.achievements[1].image}
                imageAlt={globalAchievements.achievements[1].alt}
                title={globalAchievements.achievements[1].title}
                description={globalAchievements.achievements[1].description}
                fallbackIcon={<Globe className="h-12 w-12 text-white/25" aria-hidden />}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <HeroSection />
      <VisionMissionSection />
      <QuickActionTiles />
      <WhyShareSection />
      <CategoryChipsSection />
      <EventAnnouncement />
      <StatisticsBar />
      <RecognitionStrip />
      <TopAchievementsSection />
      <PlatformFeaturedStrip />
      <InstitutionalSection />
    </div>
  );
}