"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type ImageWithFallbackProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
};

const ImageWithFallback = ({ src, alt, className, sizes }: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center bg-slate-200">
        <span className="text-xs text-slate-500">الصورة غير متاحة</span>
      </div>
    );
  }

  return (
    <div className="relative h-[520px] w-full">
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes ?? "(max-width: 1024px) 100vw, 50vw"}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

export default function InstitutionalSection() {
  return (
    <section className="relative overflow-hidden bg-[#eef3fb] py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10">
        <div>
          <div className="inline-flex rounded-full bg-[#dce8ff] px-4 py-2 text-sm font-bold text-[#0a4fd6]">
            For Schools
          </div>

          <h2 className="mt-5 text-4xl font-black leading-tight text-slate-950 lg:text-5xl">
            واجهة مؤسسية تبرز أثر المدرسة في صناعة التميز
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            توظف منصة تميز الأنجال الصور الحقيقية للوفود والمشاركات والمحافل الرسمية
            لإظهار الأثر المؤسسي الحقيقي للمدرسة، وربط إنجاز الطالب بصورة المدرسة ورسالتها.
          </p>

          <div className="mt-8 space-y-4">
            {[
              "توثيق الإنجازات بصورة احترافية ومعتمدة",
              "إبراز المشاركات المحلية والوطنية والعالمية",
              "بناء واجهة مؤسسية حديثة تعكس جودة المدرسة",
              "تعزيز الفخر والانتماء والهوية التعليمية",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-2 h-2.5 w-2.5 rounded-full bg-[#d4af37]" />
                <p className="text-base leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/about"
              className="inline-flex items-center justify-center rounded-md bg-[#0a4fd6] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0b44b4]"
            >
              تعرف على المنصة
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[30px] bg-white shadow-xl">
          <ImageWithFallback
            src="/images/landing/airport-delegation.jpg"
            alt="وفد طلابي من مدارس الأنجال في مشاركة رسمية"
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
      </div>
    </section>
  );
}
