"use client";

import { recognitions } from "@/data/landing-content";

const RecognitionStrip = () => {
  return (
    <section className="py-12 bg-white border-y border-gray-200">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-text mb-2">
            مشاركات ومعارض ومسابقات بارزة
          </h2>
          <p className="text-text-light">
            إنجازات طلاب مدارس الأنجال الأهلية في المحافل المحلية والعالمية
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
          {recognitions.map((recognition) => (
            <div
              key={recognition.id}
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary-dark text-white rounded-full font-semibold text-sm md:text-base shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              {recognition.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecognitionStrip;
