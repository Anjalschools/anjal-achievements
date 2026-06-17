"use client";

import { Star } from "lucide-react";

type SurveySatisfactionControlProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  max?: number;
  isAr?: boolean;
  disabled?: boolean;
};

const SurveySatisfactionControl = ({
  value,
  onChange,
  label,
  max = 10,
  isAr = true,
  disabled = false,
}: SurveySatisfactionControlProps) => {
  const options = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={label}>
        {options.map((n) => {
          const selected = value >= n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              role="radio"
              aria-checked={value === n}
              aria-label={`${n}/${max}`}
              onClick={() => onChange(n)}
              className={`rounded-lg p-0.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
                selected ? "text-amber-500" : "text-border"
              }`}
            >
              <Star className={`h-6 w-6 ${selected ? "fill-current" : ""}`} aria-hidden />
            </button>
          );
        })}
        <span className="ms-2 text-sm font-black text-primary">
          {value}/{max}
        </span>
      </div>
      <p className="text-xs text-text-light">
        {isAr ? "اضغط لتحديد مستوى الرضا العام" : "Tap to set overall satisfaction"}
      </p>
    </div>
  );
};

export default SurveySatisfactionControl;
