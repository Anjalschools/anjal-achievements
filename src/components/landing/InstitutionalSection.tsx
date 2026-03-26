"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import SafeLocalImage from "@/components/media/SafeLocalImage";
import { PUBLIC_IMG } from "@/lib/publicImages";

export default function InstitutionalSection() {
  const fallback = (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0a4fd6]/15 via-[#eef3fb] to-[#d4af37]/25 px-6"
      role="img"
      aria-label="صورة توضيحية"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/90 shadow-lg ring-1 ring-[#0a4fd6]/15">
        <Building2 className="h-10 w-10 text-[#0a4fd6]" aria-hidden />
      </div>
    </div>
  );

  return (
    <section className="relative overflow-hidden border-t border-slate-200/80 bg-gray-50 py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16 lg:px-10">
        <div className="mx-auto max-w-xl space-y-4 text-start">
          <div className="inline-flex rounded-full bg-[#dce8ff] px-4 py-2 text-sm font-semibold text-[#0a4fd6]">
            For Schools
          </div>

          <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-950">
            واجهة مؤسسية تبرز أثر المدرسة في صناعة التميز
          </h2>

          <p className="text-base leading-relaxed text-gray-600">
            توظف منصة تميز الأنجال الصور الحقيقية للوفود والمشاركات والمحافل الرسمية لإظهار الأثر المؤسسي الحقيقي للمدرسة، وربط إنجاز الطالب بصورة المدرسة ورسالتها.
          </p>

          <div className="space-y-4 pt-2">
            {[
              "توثيق الإنجازات بصورة احترافية ومعتمدة",
              "إبراز المشاركات المحلية والوطنية والعالمية",
              "بناء واجهة مؤسسية حديثة تعكس جودة المدرسة",
              "تعزيز الفخر والانتماء والهوية التعليمية",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#d4af37]" />
                <p className="text-base leading-relaxed text-slate-700">{item}</p>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Link
              href="/login?from=landing"
              className="inline-flex items-center justify-center rounded-md bg-[#0a4fd6] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0b44b4]"
            >
              تعرف على المنصة
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200/80">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-50">
              <SafeLocalImage
                src={PUBLIC_IMG.faceSchools}
                alt="واجهة مؤسسية — مدارس الأنجال"
                fill
                sizes="(max-width: 1024px) 100vw, 28rem"
                objectFit="contain"
                className="object-center p-2"
                fallback={fallback}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
