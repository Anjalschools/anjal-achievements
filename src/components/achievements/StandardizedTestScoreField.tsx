"use client";

import { useMemo } from "react";
import {
  getStandardizedTestInputConfig,
  normalizeStandardizedTestScore,
  type StandardizedTestType,
} from "@/lib/standardized-tests/standardized-test-rules";

export type StandardizedTestScoreFieldProps = {
  testType: StandardizedTestType;
  value: string;
  onChange: (value: string) => void;
  isAr: boolean;
  error?: string;
  disabled?: boolean;
};

const StandardizedTestScoreField = ({
  testType,
  value,
  onChange,
  isAr,
  error,
  disabled = false,
}: StandardizedTestScoreFieldProps) => {
  const cfg = useMemo(() => getStandardizedTestInputConfig(testType), [testType]);

  const preview = useMemo(() => {
    const v = value.trim();
    if (!v) return null;
    const n = normalizeStandardizedTestScore(testType, v);
    return n.isValid ? n.scoreLabel : null;
  }, [testType, value]);

  const handleChange = (raw: string) => {
    if (testType === "ielts") {
      onChange(raw.replace(/[^\d.]/g, "").slice(0, 4));
      return;
    }
    onChange(raw.replace(/[^\d]/g, "").slice(0, 6));
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-text">
        {isAr ? "درجة الاختبار" : "Test score"} *
      </label>
      <input
        type="text"
        inputMode={cfg.inputMode}
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-xl border ${
          error ? "border-red-300" : "border-gray-300"
        } bg-white px-4 py-3 text-sm`}
        placeholder={isAr ? cfg.placeholderAr : cfg.placeholderEn}
      />
      <p className="mt-1 text-xs text-text-light">{isAr ? cfg.hintAr : cfg.hintEn}</p>
      {preview ? (
        <p className="mt-1 text-xs font-semibold text-primary">
          {isAr ? `العرض: ${preview}` : `Display: ${preview}`}
        </p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
};

export default StandardizedTestScoreField;
