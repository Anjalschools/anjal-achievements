"use client";

import TopUtilityBar from "@/components/landing/TopUtilityBar";
import MainHeader from "@/components/landing/MainHeader";
import InstitutionalSection from "@/components/landing/InstitutionalSection";
import SiteFooter from "@/components/landing/SiteFooter";
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
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-[#071a3d]">
      <div className="absolute inset-0">
        <Image
          src="/images/landing/hero-celebration.jpg"
          alt="طلاب مدارس الأنجال يحتفلون بتحقيق الإنجاز"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,26,61,0.95)_0%,rgba(7,26,61,0.88)_38%,rgba(7,26,61,0.58)_68%,rgba(7,26,61,0.25)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.22),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.16),transparent_24%)]" />

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "url('/placeholders/pattern.svg')",
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
            <div className="relative h-32 w-48">
              <Image
                src="/logow.png"
                alt="شعار مدارس الأنجال الأهلية"
                fill
                priority
                className="object-contain"
                sizes="192px"
              />
            </div>
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
                <h2 className="text-center text-3xl font-black text-white md:text-4xl">
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
                <p className="text-2xl font-black text-[#d4af37]">
                  3 جوائز قيمة للطلاب المحققين تنوعًا في الإنجازات والحاصلين على
                  أعلى النقاط
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

type ImageWithFallbackProps = {
  src: string;
  alt: string;
  className?: string;
  objectFit?: "cover" | "contain";
  objectPosition?: "center" | "top";
  bgColor?: string;
};

const ImageWithFallback = ({
  src,
  alt,
  className,
  objectFit = "cover",
  objectPosition = "center",
  bgColor,
}: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-52 w-full items-center justify-center rounded-xl bg-slate-200">
        <span className="text-xs text-slate-500">الصورة غير متاحة</span>
      </div>
    );
  }

  const positionClass =
    objectPosition === "top" ? "object-top" : "object-center";
  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div
      className={`relative h-52 w-full overflow-hidden rounded-xl ${bgColor ?? ""}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={`${className ?? ""} ${fitClass} ${positionClass}`}
        sizes="(max-width: 768px) 100vw, 50vw"
        onError={() => setHasError(true)}
      />
    </div>
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
        image: "/sahib.jpg",
        alt: "قصة إنجاز ملهمة",
      },
      {
        title: "ملفات إنجاز حديثة",
        description: "إبراز قصص النجاح بأسلوب عرض بصري حديث ومؤثر",
        image: "/timss-or-school-excellence.jpg",
        alt: "ملفات إنجاز حديثة",
      },
    ],
  };

  const globalAchievements = {
    title: "الإنجازات العالمية",
    achievements: [
      {
        title: "مشاركة عالمية في ISEF",
        description: "تمثيل مشرف لطلاب مدارس الأنجال في المحافل الدولية",
        image: "/global-isef-group1.jpg",
        alt: "مشاركة عالمية في ISEF",
      },
      {
        title: "تمثيل المملكة دوليًا",
        description: "إنجازات طلابية ترفع راية الوطن في المحافل الدولية",
        image: "/global-isef-group.jpg",
        alt: "تمثيل المملكة دوليًا",
      },
    ],
  };

  return (
    <section className="bg-background-soft py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-black text-slate-950 md:text-4xl">
            إبراز النماذج المتميزة والإنجازات البارزة
          </h2>
          <p className="mx-auto mb-2 max-w-2xl text-lg text-slate-500">
            واجهة مؤسسية تبرز أثر المدرسة في صناعة التميز
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#b8941f] p-8 text-slate-950 shadow-lg">
            <div className="mb-6 flex items-center gap-3">
              <Star className="h-8 w-8 text-slate-950" />
              <h3 className="text-2xl font-black">{weeklySpotlight.title}</h3>
            </div>

            <div className="space-y-4">
              {weeklySpotlight.achievements.map((achievement, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-slate-950/10 bg-white/20 p-5 backdrop-blur-sm"
                >
                  <ImageWithFallback
                    src={achievement.image}
                    alt={achievement.alt}
                    objectFit={index === 1 ? "contain" : "cover"}
                    bgColor={index === 1 ? "bg-slate-50" : undefined}
                  />

                  <div className="mt-4">
                    <h4 className="mb-2 text-lg font-bold">
                      {achievement.title}
                    </h4>
                    <p className="text-sm text-slate-800">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-[#071a3d] to-[#1e3a8a] p-8 text-white shadow-lg">
            <div className="mb-6 flex items-center gap-3">
              <Globe className="h-8 w-8 text-[#d4af37]" />
              <h3 className="text-2xl font-black">
                {globalAchievements.title}
              </h3>
            </div>

            <div className="space-y-4">
              {globalAchievements.achievements.map((achievement, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm"
                >
                  <ImageWithFallback
                    src={achievement.image}
                    alt={achievement.alt}
                    objectFit="cover"
                  />

                  <div className="mt-4">
                    <h4 className="mb-2 text-lg font-bold">
                      {achievement.title}
                    </h4>
                    <p className="text-sm text-white/80">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <TopUtilityBar />
      <MainHeader />
      <HeroSection />
      <VisionMissionSection />
      <QuickActionTiles />
      <WhyShareSection />
      <CategoryChipsSection />
      <EventAnnouncement />
      <StatisticsBar />
      <RecognitionStrip />
      <TopAchievementsSection />
      <InstitutionalSection />
      <SiteFooter />
    </main>
  );
}