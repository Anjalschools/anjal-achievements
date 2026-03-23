/**
 * Whether create/edit user forms should collect school placement (grade, section).
 * Staff accounts still receive schema defaults on the server (see admin user service).
 */

export const roleNeedsAcademicFields = (role: string | undefined | null): boolean =>
  String(role ?? "").trim() === "student";
