import { normalizeGrade } from "@/constants/grades";
import type { StaffScopePayload } from "@/lib/user-scope";

const GENDER_SET = new Set<string>(["male", "female"]);
const SECTION_SET = new Set<string>(["arabic", "international"]);

const uniq = <T>(arr: T[]): T[] => [...new Set(arr)];

/** Accepts string | string[] | unknown from JSON; returns trimmed unique strings. */
export const sanitizeStringArray = (raw: unknown): string[] => {
  if (raw === undefined || raw === null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return uniq(
    list
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
  );
};

/**
 * Normalizes client payload into a staffScope subdocument, or `null` to clear scope,
 * or `undefined` when the field should not be changed (PATCH omit).
 */
export const normalizeStaffScopeInput = (
  raw: unknown
): StaffScopePayload | null | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object" || raw === null) return undefined;

  const o = raw as Record<string, unknown>;
  const genders = sanitizeStringArray(o.genders).filter((g) =>
    GENDER_SET.has(g)
  ) as ("male" | "female")[];
  const sections = sanitizeStringArray(o.sections).filter((s) =>
    SECTION_SET.has(s)
  ) as ("arabic" | "international")[];
  const grades = sanitizeStringArray(o.grades)
    .map((g) => normalizeGrade(g) || g)
    .filter(Boolean);

  const out: StaffScopePayload = {};
  if (genders.length) out.genders = genders;
  if (sections.length) out.sections = sections;
  if (grades.length) out.grades = grades;

  if (!out.genders?.length && !out.sections?.length && !out.grades?.length) {
    return null;
  }
  return out;
};

/** Roles that may persist organizational scope (stored on `staffScope`). */
export const ROLES_WITH_STAFF_SCOPE_UI = new Set([
  "admin",
  "supervisor",
  "schoolAdmin",
  "teacher",
  "judge",
]);

export const roleSupportsStaffScopeStorage = (role: string | undefined | null): boolean =>
  ROLES_WITH_STAFF_SCOPE_UI.has(String(role || "").trim());
