import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import type { IUser } from "@/models/User";
import { resolveEffectiveStaffScope } from "@/lib/user-scope";

/**
 * Mongo filter on Achievement for staff restricted by organizational scope.
 * `null` = no extra restriction (full access).
 */
export const buildAchievementAccessFilter = async (
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

  const snapshotParts: Record<string, unknown>[] = [];
  if (scope.genders?.length) {
    snapshotParts.push({ "studentSnapshot.gender": { $in: scope.genders } });
  }
  if (scope.grades?.length) {
    snapshotParts.push({ "studentSnapshot.grade": { $in: scope.grades } });
  }
  if (scope.sections?.length) {
    snapshotParts.push({ "studentSnapshot.section": { $in: scope.sections } });
  }

  const ors: Record<string, unknown>[] = [];
  if (idList.length) ors.push({ userId: { $in: idList } });
  if (snapshotParts.length) ors.push({ $and: snapshotParts });

  if (ors.length === 0) {
    return { _id: { $in: [] as mongoose.Types.ObjectId[] } };
  }
  return ors.length === 1 ? ors[0] : { $or: ors };
};

export const mergeWithAchievementScope = (
  base: Record<string, unknown>,
  scope: Record<string, unknown> | null
): Record<string, unknown> => {
  if (!scope || Object.keys(scope).length === 0) return base;
  if (!base || Object.keys(base).length === 0) return scope;
  return { $and: [base, scope] };
};

export const achievementVisibleToStaff = async (
  achievementId: string,
  user: IUser & { _id?: mongoose.Types.ObjectId }
): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(achievementId)) return false;
  const scope = await buildAchievementAccessFilter(user);
  if (!scope) {
    const n = await Achievement.countDocuments({ _id: achievementId });
    return n > 0;
  }
  const n = await Achievement.countDocuments(
    mergeWithAchievementScope({ _id: new mongoose.Types.ObjectId(achievementId) }, scope)
  );
  return n > 0;
};
