"use client";

import { quickActions } from "@/data/landing-content";

const QuickActionTiles = () => {
  return (
    <section className="py-16 bg-background-soft">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <a
              key={action.id}
              href={action.href}
              className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-primary group"
            >
              <div className="space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary transition-colors">
                  <svg
                    className="w-8 h-8 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-text group-hover:text-primary transition-colors">
                  {action.title}
                </h3>
                <p className="text-text-light leading-relaxed">
                  {action.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default QuickActionTiles;
