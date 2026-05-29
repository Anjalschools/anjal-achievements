/**
 * Executive wording — concise labels, capped CAGR, baseline context.
 */

export type ExecutiveCagrPresentation = {
  display: string;
  raw: number;
  capped: boolean;
  baselineYears: number;
  exploratory: boolean;
};

const CAGR_CAP = 85;

export const formatExecutiveCagr = (
  cagr: number,
  yearSpan: number,
  opts?: { locale?: "ar" | "en" }
): ExecutiveCagrPresentation => {
  const loc = opts?.locale ?? "ar";
  const raw = Math.round(cagr * 10) / 10;
  const capped = Math.abs(raw) > CAGR_CAP;
  const displayVal = capped ? (raw > 0 ? CAGR_CAP : -CAGR_CAP) : raw;
  const exploratory = yearSpan < 3;

  const baseline =
    loc === "ar"
      ? `على ${yearSpan} سنوات`
      : `over ${yearSpan} years`;

  const suffix = capped
    ? loc === "ar"
      ? ` (محدود عند ±${CAGR_CAP}%)`
      : ` (capped at ±${CAGR_CAP}%)`
    : "";

  return {
    raw,
    capped,
    baselineYears: yearSpan,
    exploratory,
    display: exploratory
      ? loc === "ar"
        ? `اتجاه أولي ${displayVal > 0 ? "+" : ""}${displayVal}% · ${baseline}`
        : `Early trend ${displayVal > 0 ? "+" : ""}${displayVal}% · ${baseline}`
      : `${displayVal > 0 ? "+" : ""}${displayVal}% CAGR · ${baseline}${suffix}`,
  };
};

export const shortenExecutiveSentence = (text: string, maxLen = 140): string => {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
};
