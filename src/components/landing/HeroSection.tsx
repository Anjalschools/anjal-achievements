"use client";

import Link from "next/link";
import PlatformLogo from "@/components/branding/PlatformLogo";
import SafeLocalImage from "@/components/media/SafeLocalImage";
import { PUBLIC_IMG } from "@/lib/publicImages";

const heroStats = [
  { value: "#1", label: "القدرات على مستوى المملكة" },
  { value: "#1", label: "التحصيلي على مستوى المملكة" },
  { value: "24", label: "درع تميز خلال عامين" },
  { value: "+2000", label: "منحة تعليمية للطلبة الموهوبين" },
];

const heroImageFallback = <div className="absolute inset-0 bg-[#071a3d]" aria-hidden />;

export default function HeroSection() {
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
              منصة تميز الأنجال
              <span className="mt-2 block text-[#d4af37]">إنجازات تصنع المستقبل</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 sm:text-lg">
              سجّل إنجازاتك، تابع مشاركاتك، وابنِ ملفًا يعكس تميزك أمام المدرسة والمجتمع التعليمي.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {heroStats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm">
                  <div className="text-2xl font-black text-[#d4af37]">{s.value}</div>
                  <div className="mt-2 text-xs text-white/80">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-[#d4af37] px-8 py-4 text-base font-bold text-[#071a3d] transition hover:bg-[#e5be4a]"
              >
                ابدأ الآن
              </Link>
              <Link
                href="/achievements"
                className="inline-flex items-center justify-center rounded-md border border-white/25 px-8 py-4 text-base font-bold text-white transition hover:bg-white/10"
              >
                استكشف الإنجازات
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
}
