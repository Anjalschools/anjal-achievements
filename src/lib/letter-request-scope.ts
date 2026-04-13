import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import type { IUser } from "@/models/User";
import { resolveEffectiveStaffScope } from "@/lib/user-scope";

/**
 * Mongo filter on LetterRequest.userId for staff restricted by organizational scope.
 * `null` = no extra restriction (full access).
 */
export const buildLetterRequestStaffFilter = async (
  user: IUser & { _id?: mongoose.Types.ObjectId }
): Promise<Record<string, unknown> | null> => {
  const scope = resolveEffectiveStaffScope(user as IUser & { staffScope?: import("@/lib/user-scope").StaffScopePayload });
  if (scope.unrestricted) return null;

  await connectDB();

  const studentQuery: Record<string, unknown> = { role: "student" };
  if (scope.genders?.length) studentQuery.gender = { $in: scope.genders };
  if (scope.sections?.length) studentQuery.section = { $in: scope.sections };
  if (scope.grades?.length) studentQuery.grade = { $in: scope.grades };

  const idDocs = await User.find(studentQuery).select("_id").lean().exec();
  const idList = idDocs.map((d) => d._id);

  if (idList.length === 0) {
    return { userId: { $in: [] as mongoose.Types.ObjectId[] } };
  }
  return { userId: { $in: idList } };
};

export const mergeLetterRequestScope = (
  base: Record<string, unknown>,
  scope: Record<string, unknown> | null
): Record<string, unknown> => {
  if (!scope || Object.keys(scope).length === 0) return base;
  if (!base || Object.keys(base).length === 0) return scope;
  return { $and: [base, scope] };
};

export const letterRequestVisibleToStaff = async (
  letterRequestId: string,
  user: IUser & { _id?: mongoose.Types.ObjectId }
): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(letterRequestId)) return false;
  const scope = await buildLetterRequestStaffFilter(user);
  if (!scope) {
    const LetterRequest = (await import("@/models/LetterRequest")).default;
    const n = await LetterRequest.countDocuments({ _id: letterRequestId });
    return n > 0;
  }
  const LetterRequest = (await import("@/models/LetterRequest")).default;
  const n = await LetterRequest.countDocuments(
    mergeLetterRequestScope({ _id: new mongoose.Types.ObjectId(letterRequestId) }, scope)
  );
  return n > 0;
};
