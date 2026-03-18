"use client";

import { categories } from "@/data/landing-content";

const CategoryChips = () => {
  return (
    <section className="py-16 bg-background-soft">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">
            مجالات الإنجاز
          </h2>
          <p className="text-lg text-text-light max-w-2xl mx-auto">
            استكشف الإنجازات المتميزة عبر مختلف المجالات التعليمية والتربوية
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/categories/${category.id}`}
              className="px-6 py-3 bg-white text-text rounded-full font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border border-gray-200 hover:border-primary hover:text-primary"
            >
              {category.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoryChips;
