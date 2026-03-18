"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const heroStats = [
  { value: "#1", label: "القدرات على مستوى المملكة" },
  { value: "#1", label: "التحصيلي على مستوى المملكة" },
  { value: "24", label: "درع تميز خلال عامين" },
  { value: "+2000", label: "منحة تعليمية للطلبة الموهوبين" },
];

type ImageWithFallbackProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

const ImageWithFallback = ({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
        <span className="text-xs text-slate-400">الصورة غير متاحة</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      className={className}
      sizes={sizes ?? "100vw"}
      onError={() => setHasError(true)}
    />
  );
};

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#071a3d]">
      <div className="absolute inset-0">
        <ImageWithFallback
          src="/images/landing/hero-celebration.jpg"
          alt="طلاب مدارس الأنجال يحتفلون بتحقيق الإنجاز والكأس"
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,26,61,0.95)_0%,rgba(7,26,61,0.88)_38%,rgba(7,26,61,0.58)_68%,rgba(7,26,61,0.25)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.22),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.16),transparent_24%)]" />
      
      {/* Pattern overlay */}
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
              منصة تميز الأنجال
              <span className="mt-2 block text-[#d4af37]">إنجازات تصنع المستقبل</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 sm:text-lg">
              منصة رقمية احترافية لتوثيق وتصنيف وإبراز إنجازات طلاب مدارس الأنجال الأهلية،
              محليًا ووطنيًا وعالميًا، وفق معايير واضحة، وتصنيفات عادلة، وتجربة عرض حديثة
              تليق بصناعة التميز.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/achievements"
                className="inline-flex items-center justify-center rounded-md bg-[#d4af37] px-6 py-3 text-sm font-bold text-[#071a3d] transition hover:bg-[#e5be4a]"
              >
                استكشف الإنجازات
              </Link>

              <Link
                href="/hall-of-fame"
                className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                عرض Hall of Fame
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 lg:mt-12 lg:max-w-2xl lg:grid-cols-4">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md"
                >
                  <div className="text-2xl font-black text-[#d4af37] sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/85">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* School Logo */}
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
}
