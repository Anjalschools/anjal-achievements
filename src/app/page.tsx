"use client";

import TopUtilityBar from "@/components/landing/TopUtilityBar";
import MainHeader from "@/components/landing/MainHeader";
import CategoryChips from "@/components/landing/CategoryChips";
import InstitutionalSection from "@/components/landing/InstitutionalSection";
import SiteFooter from "@/components/landing/SiteFooter";
import { quickActions, recognitions, categories } from "@/data/landing-content";
import { Upload, Trophy, Medal, Award, Check, CalendarDays, Users, Award as AwardIcon, FileText, Target, Star, Globe, Eye, Lightbulb } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Hero Section with updated content
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
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
              منصة تميز الأنجال
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-7xl">
              سجّل إنجازك وابدأ رحلتك نحو التميز
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 sm:text-lg">
              ارفع إنجازاتك، وشاركها مع مجتمعك التعليمي، واحصل على فرص التكريم في حفل التميّز للطلاب، واستفد من المنصة في توثيق إنجازاتك وتعزيز فرصك في التسجيل في الجامعات المحلية والعالمية.
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

// Vision & Mission Section
const VisionMissionSection = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-slate-950 mb-12 text-center">
            رؤيتنا - رسالتنا
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Eye className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-black text-primary">الرؤية</h3>
              </div>
              <p className="text-slate-700 leading-relaxed text-lg">
                إبراز تميز طلاب مدارس الأنجال وتوثيق إنجازاتهم في منصة تربوية حديثة تدعم التنافس الإيجابي والتميز الأكاديمي والمهاري.
              </p>
            </div>
            <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-2xl p-8 border border-secondary/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                  <Lightbulb className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-2xl font-black text-secondary">الرسالة</h3>
              </div>
              <p className="text-slate-700 leading-relaxed text-lg">
                توفير بيئة رقمية موثوقة لتسجيل الإنجازات المعتمدة، وتحفيز الطلاب على المشاركة، وتعزيز فرص التكريم والظهور المشرف محليًا وعالميًا.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Quick Action Tiles - updated
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
    <section className="py-16 bg-background-soft">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-6">
          {updatedActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <a
                key={action.id}
                href={action.href}
                className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-primary group"
              >
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary transition-colors">
                    <IconComponent className="w-8 h-8 text-primary group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-text group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-text-light leading-relaxed">
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

// Why Share Section
const WhyShareSection = () => {
  const benefits = [
    "توثيق رسمي لإنجازاتك",
    "فرصة للترشيح لمسابقات التميّز",
    "دخول في برامج التكريم المدرسي",
    "تعزيز ملفك الأكاديمي",
    "الظهور ضمن الطلاب المتميزين في المنصة",
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-text mb-8 text-center">
            لماذا تشارك إنجازك؟
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-background-soft p-6 rounded-xl shadow-md border border-gray-100 hover:border-primary transition-all duration-200 flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <p className="text-lg font-medium text-text leading-relaxed pt-1">
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

// Category Chips with description
const CategoryChipsSection = () => {
  return (
    <section className="py-16 bg-background-soft">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">
            مجالات الإنجاز
          </h2>
          <p className="text-lg text-text-light max-w-2xl mx-auto">
            استكشف الإنجازات المتميزة عبر مختلف المجالات التعليمية والتربوية
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/categories/${category.id}`}
              className="px-6 py-3 bg-white text-text rounded-full font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border border-gray-200 hover:border-primary hover:text-primary"
            >
              {category.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

// Event Announcement Banner - Updated Design
const EventAnnouncement = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-background-soft rounded-2xl shadow-xl border-t-4 border-[#d4af37] overflow-hidden">
            <div className="bg-gradient-to-r from-[#071a3d] to-[#1e3a8a] px-8 py-6">
              <div className="flex items-center justify-center gap-3">
                <Trophy className="w-10 h-10 text-[#d4af37]" />
                <h2 className="text-3xl md:text-4xl font-black text-white text-center">
                  حفل تكريم الإنجازات الطلابية
                </h2>
                <CalendarDays className="w-10 h-10 text-[#d4af37]" />
              </div>
            </div>

            <div className="p-8">
              <p className="text-lg leading-8 text-slate-800 mb-6 text-center">
                تدعو مدارس الأنجال الأهلية طلابها إلى رفع إنجازاتهم في المنصة استعدادًا لحفل تكريم الإنجازات الطلابية، والذي سيقام يوم <span className="font-bold text-[#071a3d]">الأربعاء 3 / 6 / 2026م</span> على مسرح مدارس الأنجال.
              </p>

              <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <h3 className="text-xl font-bold text-[#071a3d] mb-4">ويشمل التكريم:</h3>
                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#d4af37] mt-0.5 flex-shrink-0" />
                    <span>الطلاب المحققين لإنجازات على مستوى المملكة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#d4af37] mt-0.5 flex-shrink-0" />
                    <span>الطلاب المحققين لإنجازات على مستوى العالم</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#d4af37] mt-0.5 flex-shrink-0" />
                    <span>الطلاب الحاصلين على 99٪ إلى 100٪ في اختبار القدرات</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-[#d4af37] mt-0.5 flex-shrink-0" />
                    <span>الطلاب المشاركين في مسابقات على مستوى المملكة أو على مستوى العالم</span>
                  </li>
                </ul>
              </div>

              <div className="bg-[#071a3d] rounded-xl p-6 text-white">
                <p className="text-lg font-bold mb-2">كما سيتم تقديم:</p>
                <p className="text-2xl font-black text-[#d4af37]">3 جوائز كبرى للطلاب الأعلى تحقيقًا للنقاط في المسابقة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Statistics Bar
const StatisticsBar = () => {
  const stats = [
    { value: "200+", label: "عدد الطلاب المسجلين", icon: Users },
    { value: "60+", label: "عدد الجوائز المقدمة", icon: AwardIcon },
    { value: "500+", label: "عدد الإنجازات", icon: FileText },
    { value: "12", label: "عدد مجالات الإنجاز", icon: Target },
  ];

  return (
    <section className="py-12 bg-background-soft border-y border-gray-200">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <div key={stat.label} className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <IconComponent className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-sm md:text-base text-slate-600 font-medium">
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

// Recognition Strip - limited to 6 items
const RecognitionStrip = () => {
  const limitedRecognitions = recognitions.slice(0, 6);

  return (
    <section className="py-12 bg-white border-y border-gray-200">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-text mb-2">
            مشاركات طلاب وطالبات مدارس الأنجال بالمعارض والمسابقات المحلية والعالمية
          </h2>
          <p className="text-text-light">
            إنجازات طلاب مدارس الأنجال الأهلية في المحافل المحلية والعالمية
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
          {limitedRecognitions.map((recognition) => (
            <div
              key={recognition.id}
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary-dark text-white rounded-full font-semibold text-sm md:text-base shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              {recognition.name}
            </div>
          ))}
          <Link
            href="/competitions"
            className="px-6 py-3 bg-white border-2 border-primary text-primary rounded-full font-semibold text-sm md:text-base shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-white"
          >
            عرض المزيد
          </Link>
        </div>
      </div>
    </section>
  );
};

// Top Achievements Section with Images
const TopAchievementsSection = () => {
  const weeklySpotlight = {
    title: "الإنجاز الأسبوعي",
    achievements: [
      {
        title: "قصة إنجاز ملهمة",
        description: "حصول الطالب/ عبدالله السحيب على الميدالية البرونزية في ملتقى الربيع 2025م المقام بمدينة الرياض تخصص فيزياء للتدريبات على الأولمبياد الدولية 2025م ",
        image: "/sahib.jpg",
        alt: "فريق طلاب مدارس الأنجال في معرض ISEF",
      },
      {
        title: "ملفات إنجاز حديثة",
        description: "إبراز قصص النجاح بأسلوب عرض بصري حديث ومؤثر",
        image: "/timss-or-school-excellence.jpg",
        alt: "كولاج إنجازات طلاب مدارس الأنجال",
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
        alt: "فريق طلاب مدارس الأنجال في معرض ISEF",
      },
      {
        title: "تمثيل المملكة دوليًا",
        description: "إنجازات طلابية ترفع راية الوطن في المحافل الدولية",
        image: "/global-isef-group.jpg",
        alt: "طالب من مدارس الأنجال يحمل علم المملكة",
      },
    ],
  };

  type ImageWithFallbackProps = {
    src: string;
    alt: string;
    className?: string;
    objectFit?: "cover" | "contain";
    objectPosition?: string;
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
        <div className="flex h-52 w-full items-center justify-center bg-slate-200 rounded-xl">
          <span className="text-xs text-slate-500">الصورة غير متاحة</span>
        </div>
      );
    }

    const positionClass = objectPosition === "top" ? "object-top" : "object-center";

    return (
      <div className={`relative h-52 w-full rounded-xl overflow-hidden ${bgColor ?? ""}`}>
        <Image
          src={src}
          alt={alt}
          fill
          className={`${className ?? ""} ${objectFit === "contain" ? "object-contain" : "object-cover"} ${positionClass}`}
          sizes="(max-width: 768px) 100vw, 50vw"
          onError={() => setHasError(true)}
        />
      </div>
    );
  };

  return (
    <section className="py-16 bg-background-soft">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-slate-950 mb-4">
          إبراز النماذج المتميزة والإنجازات البارزة
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-2">
          واجهة مؤسسية تبرز أثر المدرسة في صناعة التميز
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-[#d4af37] to-[#b8941f] rounded-2xl p-8 text-slate-950 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-8 h-8 text-slate-950" />
              <h3 className="text-2xl font-black">{weeklySpotlight.title}</h3>
            </div>
            <div className="space-y-4">
              {weeklySpotlight.achievements.map((achievement, index) => (
                <div key={index} className="bg-white/20 backdrop-blur-sm rounded-xl p-5 border border-slate-950/10 overflow-hidden">
                  <ImageWithFallback
                    src={achievement.image}
                    alt={achievement.alt}
                    objectFit={index === 1 ? "contain" : "cover"}
                    bgColor={index === 1 ? "bg-slate-50" : undefined}
                  />
                  <div className="mt-4">
                    <h4 className="text-lg font-bold mb-2">{achievement.title}</h4>
                    <p className="text-sm text-slate-800">{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#071a3d] to-[#1e3a8a] rounded-2xl p-8 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-8 h-8 text-[#d4af37]" />
              <h3 className="text-2xl font-black">{globalAchievements.title}</h3>
            </div>
            <div className="space-y-4">
              {globalAchievements.achievements.map((achievement, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 overflow-hidden">
                  <ImageWithFallback
                    src={achievement.image}
                    alt={achievement.alt}
                    objectFit="cover"
                  />
                  <div className="mt-4">
                    <h4 className="text-lg font-bold mb-2">{achievement.title}</h4>
                    <p className="text-sm text-white/80">{achievement.description}</p>
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
