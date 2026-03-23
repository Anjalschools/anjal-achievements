/**
 * Post-login landing path by platform role (Anjal).
 * Keep in sync with `User.role` enum in `src/models/User.ts`.
 */

const STAFF_ROLES = new Set<string>([
  "admin",
  "supervisor",
  "schoolAdmin",
  "teacher",
  "judge",
]);

/** Aliases that may appear from older clients or future schema — map to the same staff landing. */
const STAFF_ROLE_ALIASES: Record<string, string> = {
  systemAdmin: "admin",
  principal: "schoolAdmin",
  activityLeader: "teacher",
};

/**
 * Returns the first path to open after a successful login.
 * - `student` → student dashboard
 * - All reviewer / admin roles in this repo → admin command dashboard
 * - Unknown or empty role → student dashboard (safe default)
 */
export const getDefaultRouteByRole = (role: string | undefined | null): string => {
  const raw = String(role ?? "").trim();
  const r = STAFF_ROLE_ALIASES[raw] ?? raw;

  if (r === "student") return "/dashboard";
  if (!r) return "/dashboard";
  if (STAFF_ROLES.has(r)) return "/admin/dashboard";
  return "/dashboard";
};
