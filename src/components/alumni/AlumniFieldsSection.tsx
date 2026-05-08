"use client";

import { memo, useMemo } from "react";
import { Brain, Briefcase, Cog, Scale, Shield, Stethoscope } from "lucide-react";
import type { AlumniField, AlumniLocale } from "@/content/alumni-landing";
import { getAlumniFieldsMock, getAlumniSectionTitles } from "@/content/alumni-landing";
import type { AlumniFieldCountItem } from "@/lib/alumni/alumni-public-types";

const FieldIcon = ({ icon }: { icon: AlumniField["icon"] }) => {
  const cls = "h-6 w-6 text-sky-200";
  switch (icon) {
    case "med":
      return <Stethoscope className={cls} aria-hidden />;
    case "eng":
      return <Cog className={cls} aria-hidden />;
    case "cyber":
      return <Shield className={cls} aria-hidden />;
    case "ai":
      return <Brain className={cls} aria-hidden />;
    case "law":
      return <Scale className={cls} aria-hidden />;
    case "biz":
      return <Briefcase className={cls} aria-hidden />;
    default:
      return null;
  }
};

type AlumniFieldsSectionProps = {
  locale: AlumniLocale;
  fields?: AlumniFieldCountItem[];
};

const detectIcon = (name: string): AlumniField["icon"] => {
  const normalized = name.toLowerCase();
  if (normalized.includes("طب") || normalized.includes("med")) return "med";
  if (normalized.includes("هندس") || normalized.includes("eng")) return "eng";
  if (normalized.includes("سيبر") || normalized.includes("cyber")) return "cyber";
  if (normalized.includes("ذكاء") || normalized.includes("ai")) return "ai";
  if (normalized.includes("قانون") || normalized.includes("law")) return "law";
  return "biz";
};

const AlumniFieldsSectionInner = ({ locale, fields }: AlumniFieldsSectionProps) => {
  const titles = getAlumniSectionTitles(locale);
  const fieldCards = useMemo(() => {
    if (!fields || fields.length === 0) return getAlumniFieldsMock();
    return fields.map((f, index) => ({
      id: `${f.field}-${index}`,
      labelAr: f.field,
      labelEn: f.field,
      icon: detectIcon(f.field),
    }));
  }, [fields]);
  const isAr = locale === "ar";

  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-slate-900 to-primary py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-black sm:text-3xl">{titles.fields}</h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fieldCards.map((f) => (
            <li
              key={f.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:bg-white/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                <FieldIcon icon={f.icon} />
              </div>
              <p className="mt-4 text-lg font-bold">{isAr ? f.labelAr : f.labelEn}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export const AlumniFieldsSection = memo(AlumniFieldsSectionInner);
