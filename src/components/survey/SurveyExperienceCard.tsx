"use client";

import { Check, Frown, Meh, Minus, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STUDENT_EXPERIENCE_RATING_LABELS } from "@/lib/partnerships/training-final-evaluation-ui-constants";

const EXPERIENCE_DESCRIPTIONS: Record<number, { ar: string; en: string }> = {
  1: { ar: "لم أستفد بشكل ملموس", en: "Little to no benefit gained" },
  2: { ar: "استفادة محدودة", en: "Limited benefit" },
  3: { ar: "استفادة متوسطة", en: "Moderate benefit" },
  4: { ar: "استفادة جيدة", en: "Good benefit" },
  5: { ar: "استفادة ممتازة", en: "Excellent benefit" },
};

const ICONS: Record<number, LucideIcon> = {
  1: Frown,
  2: ThumbsDown,
  3: Minus,
  4: ThumbsUp,
  5: Star,
};

type SurveyExperienceCardProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  isAr?: boolean;
  disabled?: boolean;
};

const SurveyExperienceCard = ({
  value,
  onChange,
  label,
  isAr = true,
  disabled = false,
}: SurveyExperienceCardProps) => {
  const selected = STUDENT_EXPERIENCE_RATING_LABELS.find((r) => r.value === value);
  const selectedDescription = selected ? EXPERIENCE_DESCRIPTIONS[selected.value] : null;

  return (
    <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-white to-muted/20 p-4 sm:p-5">
      <p className="mb-3 text-sm font-bold text-foreground sm:text-base">{label}</p>
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 touch-manipulation sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:snap-none"
        role="radiogroup"
        aria-label={label}
      >
        {STUDENT_EXPERIENCE_RATING_LABELS.map((row) => {
          const isSelected = value === row.value;
          const Icon = ICONS[row.value] || Meh;
          return (
            <button
              key={row.value}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(row.value)}
              className={`group relative min-w-[5.5rem] shrink-0 snap-start rounded-xl border-2 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 sm:min-w-0 ${
                isSelected
                  ? "border-primary bg-primary text-white shadow-md ring-2 ring-primary/30"
                  : "border-border bg-white text-text-light hover:border-primary/50"
              }`}
            >
              {isSelected ? (
                <Check className="absolute start-1.5 top-1.5 h-3.5 w-3.5 text-white" aria-hidden />
              ) : null}
              <span
                className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                  isSelected ? "bg-white/20 text-white" : "bg-muted text-foreground"
                }`}
                aria-hidden
              >
                {row.value}
              </span>
              <Icon
                className={`mx-auto mb-1 h-5 w-5 ${isSelected ? "text-white" : "text-primary/70 group-hover:text-primary"}`}
                aria-hidden
              />
              <span className={`block text-[10px] font-bold leading-tight sm:text-xs ${isSelected ? "text-white" : ""}`}>
                {isAr ? row.ar : row.en}
              </span>
            </button>
          );
        })}
      </div>
      {selected && selectedDescription ? (
        <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs font-semibold text-primary sm:text-sm">
          {isAr ? selectedDescription.ar : selectedDescription.en}
        </p>
      ) : null}
    </div>
  );
};

export default SurveyExperienceCard;
