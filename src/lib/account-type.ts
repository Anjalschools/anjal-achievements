/**
 * Shared account classification for students vs alumni (Phase 1).
 * Legacy documents omit `accountType` → treated as student.
 */

export type AccountType = "student" | "alumni";

export type AccountTypeUserLike = {
  accountType?: AccountType | null;
};

export const getAccountType = (user: AccountTypeUserLike | null | undefined): AccountType => {
  if (!user) return "student";
  return user.accountType === "alumni" ? "alumni" : "student";
};

export const isStudentAccount = (user: AccountTypeUserLike | null | undefined): boolean =>
  getAccountType(user) === "student";

export const isAlumniAccount = (user: AccountTypeUserLike | null | undefined): boolean =>
  getAccountType(user) === "alumni";
