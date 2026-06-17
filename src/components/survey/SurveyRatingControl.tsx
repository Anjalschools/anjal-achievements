"use client";

import { Check } from "lucide-react";
import {
  INSTITUTION_RATING_LABELS,
  STUDENT_EXPERIENCE_RATING_LABELS,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";

export type SurveyRatingLabelSet = "institution" | "student";

type SurveyRatingControlProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  isAr?: boolean;
  disabled?: boolean;
  labelSet?: SurveyRatingLabelSet;
  name?: string;
};

const SurveyRatingControl = ({
  value,
  onChange,
  label,
  isAr = true,
  disabled = false,
  labelSet = "institution",
  name,
}: SurveyRatingControlProps) => {
  const fieldName = name || label;
  const options = labelSet === "student" ? STUDENT_EXPERIENCE_RATING_LABELS : INSTITUTION_RATING_LABELS;
  const selectedLabel = options.find((r) => r.value === value);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 touch-manipulation sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:snap-none"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((row) => {
          const selected = value === row.value;
          return (
            <button
              key={row.value}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(row.value)}
              className={`relative min-w-[4.25rem] shrink-0 snap-start rounded-xl border-2 px-2 py-2.5 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 sm:min-w-0 ${
                selected
                  ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                  : "border-border bg-white text-text-light hover:border-primary/40"
              }`}
            >
              {selected ? (
                <Check className="absolute start-1.5 top-1.5 h-3.5 w-3.5 text-primary" aria-hidden />
              ) : null}
              <span className="block text-sm font-black leading-none">{row.value}</span>
              <span className="mt-1 block text-[10px] font-bold leading-tight sm:text-xs">
                {isAr ? row.ar : row.en}
              </span>
            </button>
          );
        })}
      </div>
      {selectedLabel ? (
        <p className="text-xs font-semibold text-primary">
          {isAr ? selectedLabel.ar : selectedLabel.en}
        </p>
      ) : null}
      <input type="hidden" name={fieldName} value={value} readOnly />
    </div>
  );
};

export default SurveyRatingControl;
