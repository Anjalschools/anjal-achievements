"use client";

import Image from "next/image";
import { rankings } from "@/data/landing-content";
import { useState } from "react";

type ImageWithFallbackProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
};

const MedalIcon = ({ src, alt, className }: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={32}
      height={32}
      className={className}
      onError={() => setHasError(true)}
    />
  );
};

const RankingsGrid = () => {
  return (
    <section className="py-16 bg-white relative overflow-hidden">
      {/* Pattern overlay - subtle */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: "url('/placeholders/pattern.svg')",
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
        }}
      />

      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MedalIcon
              src="/placeholders/medal-gold.jpg"
              alt="ميدالية ذهبية"
              className="w-8 h-8 object-contain opacity-80"
            />
            <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">
              التصنيفات والترتيبات
            </h2>
            <MedalIcon
              src="/placeholders/medal-silver.jpg"
              alt="ميدالية فضية"
              className="w-8 h-8 object-contain opacity-80"
            />
          </div>
          <p className="text-lg text-text-light max-w-2xl mx-auto">
            استكشف أفضل الطلاب والإنجازات والمدارس المتميزة
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rankings.map((ranking, index) => (
            <div
              key={ranking.id}
              className="bg-background-soft p-6 rounded-xl border border-gray-200 hover:border-primary transition-all duration-200 hover:shadow-lg relative"
            >
              {/* Medal decoration - subtle */}
              {index < 3 && (
                <div className="absolute top-4 left-4 opacity-30">
                  <MedalIcon
                    src={
                      index === 0
                        ? "/placeholders/medal-gold.jpg"
                        : index === 1
                        ? "/placeholders/medal-silver.jpg"
                        : "/placeholders/medal-bronze.jpg"
                    }
                    alt=""
                    className="w-6 h-6 object-contain"
                  />
                </div>
              )}

              <h3 className="text-xl font-bold text-text mb-4">
                {ranking.title}
              </h3>
              {ranking.students && (
                <div className="space-y-2">
                  {ranking.students.map((student, studentIndex) => (
                    <div
                      key={studentIndex}
                      className="flex items-center gap-3 p-2 bg-white rounded-lg"
                    >
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold text-sm">
                          {studentIndex + 1}
                        </span>
                      </div>
                      <span className="text-text font-medium">{student}</span>
                    </div>
                  ))}
                </div>
              )}
              {ranking.school && (
                <div className="p-4 bg-white rounded-lg">
                  <p className="text-text font-semibold text-lg">
                    {ranking.school}
                  </p>
                </div>
              )}
              {ranking.achievement && (
                <div className="p-4 bg-white rounded-lg">
                  <p className="text-text font-semibold text-lg">
                    {ranking.achievement}
                  </p>
                </div>
              )}
              <a
                href={`/rankings/${ranking.id}`}
                className="mt-4 inline-block text-primary hover:text-primary-dark font-semibold"
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
