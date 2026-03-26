import type { IUser } from "@/models/User";
import { resolveEffectiveStaffScope } from "@/lib/user-scope";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const allowedInquiryTypesForRole = (role: string): string[] | null => {
  if (role === "teacher") return ["general", "activities", "achievements"];
  if (role === "judge") return ["judging"];
  return null;
};

export const buildContactMessagesScopeFilter = (user: IUser): Record<string, unknown> => {
  const role = String(user.role || "");
  if (role === "admin" || role === "supervisor") return {};

  const scope = resolveEffectiveStaffScope(user);
  const andParts: Record<string, unknown>[] = [];

  if (!scope.unrestricted) {
    if (scope.genders?.length) {
      andParts.push({
        $or: [{ gender: { $in: scope.genders } }, { gender: { $exists: false } }, { gender: null }],
      });
    }
    if (scope.sections?.length) {
      andParts.push({
        $or: [{ section: { $in: scope.sections } }, { section: { $exists: false } }, { section: null }],
      });
    }
    if (scope.grades?.length) {
      andParts.push({
        $or: [{ grade: { $in: scope.grades } }, { grade: { $exists: false } }, { grade: null }],
      });
    }
  }

  const typeLimits = allowedInquiryTypesForRole(role);
  if (typeLimits?.length) andParts.push({ inquiryType: { $in: typeLimits } });

  return andParts.length ? { $and: andParts } : {};
};

export const buildContactMessagesSearchFilter = (q: string): Record<string, unknown> => {
  const s = q.trim();
  if (!s) return {};
  const rx = new RegExp(escapeRegExp(s), "i");
  return {
    $or: [{ fullName: rx }, { email: rx }, { phone: rx }, { subject: rx }, { message: rx }],
  };
};
