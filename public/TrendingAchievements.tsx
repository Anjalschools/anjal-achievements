"use client";

import Image from "next/image";
import { useState } from "react";

type AchievementCard = {
  title: string;
  subtitle: string;
  image?: string;
  alt?: string;
  objectFit?: "cover" | "contain";
  objectPosition?: string;
  bgColor?: string;
};

type FeaturedColumn = {
  title: string;
  tone: "dark" | "gold" | "blue";
  cards: AchievementCard[];
};

const featuredColumns: FeaturedColumn[] = [
  {
    title: "الإنجازات العالمية",
    tone: "dark",
    cards: [
      {
        title: "مشاركة عالمية في ISEF",
        subtitle: "تمثيل مشرف لطلاب مدارس الأنجال في المحافل الدولية",
        image: "/global-isef-group.jpg",
        alt: "فريق طلاب مدارس الأنجال في معرض ISEF",
        objectFit: "cover",
        objectPosition: "center",
      },
      {
        title: "تمثيل المملكة دوليًا",
        subtitle: "نماذج طلابية مؤثرة ترفع راية الوطن في المنافسات العالمية",
        image: "/images/landing/featured-saudi-flag.jpg",
        alt: "طالب من مدارس الأنجال مع علم المملكة",
        objectFit: "cover",
        objectPosition: "center",
      },
    ],
  },
  {
    title: "الواجهة الأسبوعية",
    tone: "gold",
    cards: [
      {
        title: "قصة إنجاز ملهمة",
        subtitle: "المنصة تعرض أسبوعيًا أبرز إنجازات الطلاب بشكل بصري احترافي",
        image: "/IJSO.jpg",
        alt: "طالب متميز في فعالية موهبة",
        objectFit: "cover",
        objectPosition: "top",
      },
      {
        title: "ملفات إنجاز حديثة",
        subtitle: "إبراز قصص النجاح بأسلوب عرض بصري حديث ومؤثر",
        image: "/images/landing/bebras-collage.jpg",
        alt: "كولاج إنجازات طلاب مدارس الأنجال",
        objectFit: "contain",
        bgColor: "bg-slate-50",
      },
    ],
  },
  {
    title: "الأكثر تميزًا",
    tone: "blue",
    cards: [
      {
        title: "مستويات متقدمة في TIMSS",
        subtitle: "تحقيق مستويات متقدمة ضمن المدارس المتفوقة في التقييم الدولي للعلوم والرياضيات",
      },
      {
        title: "المركز الثالث في تحدي القراءة",
        subtitle: "المركز الثالث على مستوى الوطن العربي في تحدي القراءة العربي",
      },
      {
        title: "جائزة المدرسة العالمية",
        subtitle: "المركز الأول في جائزة المدرسة العالمية ضمن جوائز مركز موهبة العالمي WGC وحمدان بن راشد 2022",
      },
      {
        title: "أولمبياد اللغة الإنجليزية",
        subtitle: "المركز الأول في أولمبياد اللغة الإنجليزية على مستوى العالم في الأردن 2023م",
      },
    ],
  },
];

function getColumnClass(tone: FeaturedColumn["tone"]) {
  if (tone === "dark") {
    return "bg-[linear-gradient(135deg,#16233f_0%,#0b1530_100%)] text-white";
  }

  if (tone === "gold") {
    return "bg-[#d4af37] text-slate-950";
  }

  return "bg-[#2848b4] text-white";
}

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
      <div className="flex h-52 w-full items-center justify-center bg-slate-200">
        <span className="text-xs text-slate-500">الصورة غير متاحة</span>
      </div>
    );
  }

  const positionClass = objectPosition === "top" ? "object-top" : "object-center";

  return (
    <div className={`relative h-52 w-full ${bgColor ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className={`${className ?? ""} ${objectFit === "contain" ? "object-contain" : "object-cover"} ${positionClass}`}
        sizes="(max-width: 768px) 100vw, 33vw"
        onError={() => setHasError(true)}
      />
    </div>
  );
};

export default function TrendingAchievements() {
  const rankingItems = [
    {
      rank: "1",
      text: "تحقيق المركز الأول في اختبارات القدرات على مستوى المملكة",
    },
    {
      rank: "2",
      text: "تحقيق المركز الأول في اختبارات التحصيلي على مستوى المملكة",
    },
    {
      rank: "3",
      text: "تحقيق المركز الأول عالميًا في جائزة الموهوبين من مؤسسة حمدان بن راشد",
    },
    {
      rank: "4",
      text: "الحصول على 24 درع تميز في نتائج التقويم والاعتماد والتصنيف المدرسي على مدى عامين متتاليين",
    },
    {
      rank: "5",
      text: "تقديم أكثر من 2000 منحة تعليمية للطلبة الموهوبين بقيمة إجمالية تجاوزت 23,000,000 ريال",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="text-center">
        <h2 className="text-4xl font-black text-slate-950 lg:text-5xl">
          أبرز إنجازات مدارس الأنجال الأهلية
        </h2>
        <p className="mt-4 text-lg text-slate-500">
          إنجازات متميزة تعكس التميز والتفوق في مختلف المجالات التعليمية والتربوية
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {featuredColumns.map((column) => (
          <div
            key={column.title}
            className={`rounded-[28px] p-6 shadow-lg ${getColumnClass(column.tone)}`}
          >
            <h3 className="text-3xl font-black">{column.title}</h3>

            <div className="mt-6 space-y-4">
              {column.cards.map((card) => (
                <div
                  key={card.title}
                  className={`overflow-hidden rounded-2xl border ${
                    column.tone === "gold"
                      ? "border-black/10 bg-white/15"
                      : "border-white/10 bg-white/10"
                  }`}
                >
                  {card.image ? (
                    <ImageWithFallback
                      src={card.image}
                      alt={card.alt ?? card.title}
                      className=""
                      objectFit={card.objectFit}
                      objectPosition={card.objectPosition}
                      bgColor={card.bgColor}
                    />
                  ) : null}

                  <div className="p-5">
                    <div className="text-xl font-black">{card.title}</div>
                    <div
                      className={`mt-2 text-sm leading-7 ${
                        column.tone === "gold" ? "text-slate-800" : "text-white/80"
                      }`}
                    >
                      {card.subtitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rankingItems.map((item) => (
          <div
            key={item.rank}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
          >
            <p className="max-w-[85%] text-lg leading-8 text-slate-800">{item.text}</p>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2ff] text-xl font-black text-[#2848b4]">
              {item.rank}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
