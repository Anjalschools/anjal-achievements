/**
 * Activity year / edition for analytics — derived only, no schema migration required.
 */

export type ActivityYearInput = {
  achievementYear?: number | string | null;
  date?: Date | string | null;
  createdAt?: Date | string | null;
  academicYear?: string | null;
};

const parseYearFromDate = (v: unknown): number | null => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getFullYear();
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.getFullYear();
  const m = s.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
};

export const resolveActivityYear = (input: ActivityYearInput): number | null => {
  if (typeof input.achievementYear === "number" && Number.isFinite(input.achievementYear)) {
    return Math.round(input.achievementYear);
  }
  const ay = String(input.academicYear || "").match(/(20\d{2})/);
  if (ay) return Number(ay[1]);

  const fromDate = parseYearFromDate(input.date);
  if (fromDate) return fromDate;
  const fromCreated = parseYearFromDate(input.createdAt);
  if (fromCreated) return fromCreated;

  return null;
};

export const formatActivityEditionLabel = (
  activityName: string,
  year: number | null,
  loc: "ar" | "en"
): string => {
  const name = String(activityName || "").trim() || (loc === "ar" ? "نشاط" : "Activity");
  if (year == null) return name;
  return loc === "ar" ? `${name} ${year}` : `${name} ${year}`;
};
