/**
 * Organizational scope for staff accounts (boys/girls, tracks, grades).
 * Reads optional `staffScope` on User; falls back to the staff member's own gender/section/grade.
 */

import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import type { IUser } from "@/models/User";
import { normalizeGrade } from "@/constants/grades";

export type StaffScopePayload = {
  genders?: ("male" | "female")[];
  sections?: ("arabic" | "international")[];
  /** Normalized grade keys as stored on User.grade */
  grades?: string[];
};

export type EffectiveStaffScope =
  | { unrestricted: true }
  | {
      unrestricted: false;
      genders?: string[];
      sections?: string[];
      grades?: string[];
    };

const SCOPED_ROLES = new Set(["schoolAdmin", "teacher", "judge"]);
const ADMIN_LIKE_ROLES = new Set(["admin", "supervisor"]);

const hasExplicitStaffScope = (ss: StaffScopePayload | undefined): boolean =>
  Boolean(
    ss &&
      ((ss.genders?.length ?? 0) > 0 ||
        (ss.sections?.length ?? 0) > 0 ||
        (ss.grades?.length ?? 0) > 0)
  );

const scopeFromStaffScopeDoc = (ss: StaffScopePayload): Exclude<EffectiveStaffScope, { unrestricted: true }> => ({
  unrestricted: false,
  genders: ss.genders?.map(String),
  sections: ss.sections?.map(String),
  grades: ss.grades?.map((g) => normalizeGrade(String(g)) || String(g)),
});

export const usesOrganizationalScope = (role: string | undefined | null): boolean =>
  SCOPED_ROLES.has(String(role || ""));

export const resolveEffectiveStaffScope = (user: IUser & { staffScope?: StaffScopePayload }): EffectiveStaffScope => {
  const role = String(user.role || "");
  const ss = user.staffScope;

  if (ADMIN_LIKE_ROLES.has(role)) {
    if (!hasExplicitStaffScope(ss)) return { unrestricted: true };
    return scopeFromStaffScopeDoc(ss!);
  }

  if (!usesOrganizationalScope(role)) {
    return { unrestricted: true };
  }

  if (hasExplicitStaffScope(ss)) {
    return scopeFromStaffScopeDoc(ss!);
  }

  return {
    unrestricted: false,
    genders: user.gender ? [String(user.gender)] : undefined,
    sections: user.section ? [String(user.section)] : undefined,
    grades: user.grade ? [normalizeGrade(String(user.grade)) || String(user.grade)] : undefined,
  };
};

/** Count students in the same organizational slice as the staff account (for scoped dashboards). */
export const countStudentsMatchingScope = async (user: IUser): Promise<number> => {
  await connectDB();
  const scope = resolveEffectiveStaffScope(user);
  if (scope.unrestricted) {
    return User.countDocuments({ role: "student" });
  }
  const q: Record<string, unknown> = { role: "student" };
  if (scope.genders?.length) q.gender = { $in: scope.genders };
  if (scope.sections?.length) q.section = { $in: scope.sections };
  if (scope.grades?.length) q.grade = { $in: scope.grades };
  return User.countDocuments(q);
};
