"use client";

import Link from "next/link";
import { FileStack, Medal, Trophy } from "lucide-react";
import SafeLocalImage from "@/components/media/SafeLocalImage";
import { PUBLIC_IMG } from "@/lib/publicImages";

type SideCard = {
  title: string;
  description: string;
  image: string;
  alt: string;
  objectFit?: "cover" | "contain";
  visual: "trophy" | "medal" | "files";
};

const sideCards: SideCard[] = [
  {
    title: "تمثيل المملكة عالميًا",
    description: "طالب من مدارس الأنجال يرفع راية الوطن في المحافل الدولية.",
    visual: "trophy",
    image: PUBLIC_IMG.saudiFlag,
    alt: "إنجاز طلابي وطني",
    objectFit: "cover",
  },
  {
    title: "تميّز موهبة",
    description: "نموذج طلابي متميز في مسارات الموهبة والتفوق.",
    visual: "medal",
    image: PUBLIC_IMG.achieveWeeklySection,
    alt: "ميدالية إنجاز",
    objectFit: "cover",
  },
  {
    title: "ملف إنجازات مصور",
    description: "عرض حديث ومؤثر لقصص النجاح الطلابية داخل المنصة.",
    visual: "files",
    image: PUBLIC_IMG.achieveFile,
    alt: "طلاب في فعالية دولية",
    objectFit: "cover",
  },
];

const VisualBlock = ({ card }: { card: SideCard }) => {
  const Icon = card.visual === "trophy" ? Trophy : card.visual === "medal" ? Medal : FileStack;
  const iconFallback = (
    <div className="flex h-56 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200/80">
      <Icon className="h-16 w-16 text-primary/35" strokeWidth={1.25} aria-hidden />
    </div>
  );

  return (
    <div className="relative h-56 w-full">
      <SafeLocalImage
        src={card.image}
        alt={card.alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        objectFit={card.objectFit ?? "cover"}
        className="object-center"
        fallback={iconFallback}
      />
    </div>
  );
};

export default function FeaturedShowcase() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#0d5cd6] via-[#2f5ed3] to-[#66d2b5] p-6 text-white lg:p-8">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url('${PUBLIC_IMG.pattern}')`,
            backgroundRepeat: "repeat",
            backgroundSize: "150px 150px",
          }}
        />

        <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between rounded-[24px] bg-white/10 p-5 backdrop-blur-sm lg:p-6">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.3em] text-white/80">Featured Story</div>
              <h3 className="mt-5 text-3xl font-black leading-tight lg:text-4xl">
                إنجازات طلاب الأنجال تصل إلى المحافل الوطنية والعالمية
              </h3>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/90 lg:text-lg">
                توظف المنصة الصور الحقيقية للإنجازات الطلابية لتقديم تجربة أصيلة وملهمة، تجمع بين التوثيق المؤسسي والبعد الوطني
                وروح المنافسة الراقية.
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
                <VisualBlock card={card} />
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
