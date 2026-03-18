"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type SideCard = {
  title: string;
  description: string;
  image: string;
  alt: string;
  objectFit?: "cover" | "contain";
  objectPosition?: string;
  bgColor?: string;
};

const sideCards: SideCard[] = [
  {
    title: "تمثيل المملكة عالميًا",
    description: "طالب من مدارس الأنجال يرفع راية الوطن في المحافل الدولية.",
    image: "/trophy-hero.jpg",
    alt: "طالب من مدارس الأنجال يحمل علم المملكة",
    objectFit: "cover",
    objectPosition: "center",
  },
  {
    title: "تميّز موهبة",
    description: "نموذج طلابي متميز في مسارات الموهبة والتفوق.",
    image: "/sahib.jpg",
    alt: "طالب مع ميدالية في فعالية موهبة",
    objectFit: "cover",
    objectPosition: "center",
  },
  {
    title: "ملف إنجازات مصور",
    description: "عرض حديث ومؤثر لقصص النجاح الطلابية داخل المنصة.",
    image: "/timss-or-school-excellence.jpg",
    alt: "ملف إنجازات مصور لطلاب مدارس الأنجال",
    objectFit: "contain",
    bgColor: "bg-slate-50",
  },
];

type ImageWithFallbackProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  objectFit?: "cover" | "contain";
  objectPosition?: string;
  bgColor?: string;
};

const ImageWithFallback = ({
  src,
  alt,
  className,
  sizes,
  objectFit = "cover",
  objectPosition = "center",
  bgColor,
}: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-56 w-full items-center justify-center bg-slate-200">
        <span className="text-xs text-slate-500">الصورة غير متاحة</span>
      </div>
    );
  }

  const positionClass = objectPosition === "top" ? "object-top" : "object-center";

  return (
    <div className={`relative h-56 w-full ${bgColor ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className={`${className ?? ""} ${objectFit === "contain" ? "object-contain" : "object-cover"} ${positionClass}`}
        sizes={sizes ?? "(max-width: 768px) 100vw, 50vw"}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

export default function FeaturedShowcase() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#0d5cd6] via-[#2f5ed3] to-[#66d2b5] p-6 text-white lg:p-8">
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "url('/placeholders/pattern.svg')",
            backgroundRepeat: "repeat",
            backgroundSize: "150px 150px",
          }}
        />

        <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between rounded-[24px] bg-white/10 p-5 backdrop-blur-sm lg:p-6">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.3em] text-white/80">
                Featured Story
              </div>
              <h3 className="mt-5 text-3xl font-black leading-tight lg:text-4xl">
                إنجازات طلاب الأنجال تصل إلى المحافل الوطنية والعالمية
              </h3>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/90 lg:text-lg">
                توظف المنصة الصور الحقيقية للإنجازات الطلابية لتقديم تجربة أصيلة وملهمة،
                تجمع بين التوثيق المؤسسي والبعد الوطني وروح المنافسة الراقية.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                <div className="rounded-2xl bg-white/10 px-4 py-5">
                  <div className="text-3xl font-black text-[#ffd34d]">#1</div>
                  <div className="mt-2 text-sm text-white/85">على مستوى المملكة</div>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-5">
                  <div className="text-3xl font-black text-[#ffd34d]">24</div>
                  <div className="mt-2 text-sm text-white/85">درع تميز</div>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-5">
                  <div className="text-3xl font-black text-[#ffd34d]">+2000</div>
                  <div className="mt-2 text-sm text-white/85">منحة تعليمية</div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link
                href="/achievements"
                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-bold text-[#0a4fd6] transition hover:bg-white/90"
              >
                استكشف قصص الإنجاز
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            {sideCards.map((card) => (
              <div
                key={card.title}
                className="overflow-hidden rounded-[24px] border border-white/15 bg-white text-slate-900 shadow-xl"
              >
                <ImageWithFallback
                  src={card.image}
                  alt={card.alt}
                  className=""
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  objectFit={card.objectFit}
                  objectPosition={card.objectPosition}
                  bgColor={card.bgColor}
                />
                <div className="p-5">
                  <h4 className="text-xl font-black text-slate-950">{card.title}</h4>
                  <p className="mt-3 leading-7 text-slate-600">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
