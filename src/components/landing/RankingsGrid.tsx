"use client";

import { Medal } from "lucide-react";
import { rankings } from "@/data/landing-content";
import SafeLocalImage from "@/components/media/SafeLocalImage";
import { PUBLIC_IMG } from "@/lib/publicImages";

const tierSrc = (tier: "gold" | "silver" | "bronze") => {
  if (tier === "gold") return PUBLIC_IMG.isef;
  if (tier === "silver") return PUBLIC_IMG.achieveFile;
  return PUBLIC_IMG.saudiFlag;
};

const MedalThumb = ({ tier }: { tier: "gold" | "silver" | "bronze" }) => {
  const fallback = (
    <Medal
      className={`h-8 w-8 shrink-0 opacity-90 ${
        tier === "gold" ? "text-amber-500" : tier === "silver" ? "text-slate-400" : "text-amber-800/80"
      }`}
      strokeWidth={1.5}
      aria-hidden
    />
  );

  return (
    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/80 ring-1 ring-gray-200/60">
      <SafeLocalImage
        src={tierSrc(tier)}
        alt=""
        fill
        sizes="32px"
        className="object-cover"
        fallback={fallback}
      />
    </div>
  );
};

const RankingsGrid = () => {
  return (
    <section className="relative overflow-hidden bg-white py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url('${PUBLIC_IMG.pattern}')`,
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
        }}
      />

      <div className="container relative mx-auto px-4">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <MedalThumb tier="gold" />
            <h2 className="mb-0 text-3xl font-bold text-text md:text-4xl">التصنيفات والترتيبات</h2>
            <MedalThumb tier="silver" />
          </div>
          <p className="mx-auto max-w-2xl text-lg text-text-light">استكشف أفضل الطلاب والإنجازات والمدارس المتميزة</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rankings.map((ranking, index) => (
            <div
              key={ranking.id}
              className="relative rounded-xl border border-gray-200 bg-background-soft p-6 transition-all duration-200 hover:border-primary hover:shadow-lg"
            >
              {index < 3 ? (
                <div className="absolute left-4 top-4 opacity-50 rtl:left-auto rtl:right-4">
                  <MedalThumb tier={index === 0 ? "gold" : index === 1 ? "silver" : "bronze"} />
                </div>
              ) : null}

              <h3 className="mb-4 text-xl font-bold text-text">{ranking.title}</h3>
              {ranking.students ? (
                <div className="space-y-2">
                  {ranking.students.map((student, studentIndex) => (
                    <div key={studentIndex} className="flex items-center gap-3 rounded-lg bg-white p-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-sm font-bold text-primary">{studentIndex + 1}</span>
                      </div>
                      <span className="font-medium text-text">{student}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {ranking.school ? (
                <div className="rounded-lg bg-white p-4">
                  <p className="text-lg font-semibold text-text">{ranking.school}</p>
                </div>
              ) : null}
              {ranking.achievement ? (
                <div className="rounded-lg bg-white p-4">
                  <p className="text-lg font-semibold text-text">{ranking.achievement}</p>
                </div>
              ) : null}
              <a
                href={`/rankings/${ranking.id}`}
                className="mt-4 inline-block font-semibold text-primary hover:text-primary-dark"
              >
                عرض التفاصيل →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RankingsGrid;
