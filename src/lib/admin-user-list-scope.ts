import type { IUser } from "@/models/User";
import { resolveEffectiveStaffScope } from "@/lib/user-scope";

/**
 * When the actor has an explicit organizational scope, restrict visible **students**
 * to that slice; non-student accounts remain listable (staff management).
 * Returns `null` when no extra restriction applies.
 */
export const buildVisibleUsersMatchForActor = (actor: IUser): Record<string, unknown> | null => {
  const scope = resolveEffectiveStaffScope(actor);
  if (scope.unrestricted) return null;

  const studentQ: Record<string, unknown> = { role: "student" };
  if (scope.genders?.length) studentQ.gender = { $in: scope.genders };
  if (scope.sections?.length) studentQ.section = { $in: scope.sections };
  if (scope.grades?.length) studentQ.grade = { $in: scope.grades };

  return { $or: [{ role: { $ne: "student" } }, studentQ] };
};

export const mergeAdminUserListFilter = (
  base: Record<string, unknown>,
  actor: IUser
): Record<string, unknown> => {
  const vis = buildVisibleUsersMatchForActor(actor);
  if (!vis) return base;
  if (!base || Object.keys(base).length === 0) return vis;
  return { $and: [base, vis] };
};

/** Whether a scoped actor may open a target user in admin UI (student rows must match scope). */
export const canActorViewTargetUser = (
  actor: IUser,
  target: Pick<IUser, "role" | "gender" | "section" | "grade">
): boolean => {
  const scope = resolveEffectiveStaffScope(actor);
  if (scope.unrestricted) return true;
  if (target.role !== "student") return true;
  if (scope.genders?.length && !scope.genders.includes(String(target.gender))) return false;
  if (scope.sections?.length && !scope.sections.includes(String(target.section))) return false;
  if (scope.grades?.length && !scope.grades.includes(String(target.grade))) return false;
  return true;
};
