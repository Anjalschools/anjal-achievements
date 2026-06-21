"use client";

import { useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { SCHOOL_INTELLIGENCE_GLOSSARY } from "@/lib/school-intelligence/school-intelligence-glossary";
import { BookOpen, X } from "lucide-react";

type SchoolIntelligenceGlossaryPanelProps = {
  isAr: boolean;
};

const SchoolIntelligenceGlossaryPanel = ({ isAr }: SchoolIntelligenceGlossaryPanelProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <BookOpen className="h-3.5 w-3.5" aria-hidden />
        {isAr ? "مسرد الذكاء المدرسي" : "School Intelligence Glossary"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={isAr ? "مسرد الذكاء المدرسي" : "School Intelligence Glossary"}
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <SectionCard className="max-h-[85vh] overflow-y-auto">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">
                  {isAr ? "مسرد الذكاء المدرسي" : "School Intelligence Glossary"}
                </h2>
                <p className="mt-1 text-sm text-text-light">
                  {isAr
                    ? "تعريفات المؤشرات والمصطلحات الأساسية في شبكة الذكاء المدرسي."
                    : "Definitions for core metrics and terms in the School Intelligence Network."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-text-light hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <dl className="space-y-4">
              {SCHOOL_INTELLIGENCE_GLOSSARY.map((entry) => (
                <div key={entry.key} className="rounded-xl border border-border/70 p-3">
                  <dt className="font-semibold">{isAr ? entry.termAr : entry.termEn}</dt>
                  <dd className="mt-1 text-sm text-text-light">
                    {isAr ? entry.definitionAr : entry.definitionEn}
                  </dd>
                </div>
              ))}
            </dl>
            </SectionCard>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default SchoolIntelligenceGlossaryPanel;
