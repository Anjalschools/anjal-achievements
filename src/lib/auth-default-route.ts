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

const ALUMNI_ADMIN_ROLE = "alumniAdmin";

/** Aliases that may appear from older clients or future schema — map to the same staff landing. */
const STAFF_ROLE_ALIASES: Record<string, string> = {
  systemAdmin: "admin",
  principal: "schoolAdmin",
  activityLeader: "teacher",
};

const normalizeRole = (role: string | undefined | null): string => {
  const raw = String(role ?? "").trim();
  return STAFF_ROLE_ALIASES[raw] ?? raw;
};

/**
 * Returns the first path to open after a successful login when `accountType` is known.
 * - Staff roles → admin command dashboard (takes precedence)
 * - Alumni → alumni hub
 * - Student / unknown → student dashboard
 */
export const getPostLoginDestination = (input: {
  role?: string | null;
  accountType?: string | null;
}): string => {
  const r = normalizeRole(input.role);
  if (r === ALUMNI_ADMIN_ROLE) return "/admin/alumni";
  if (r && STAFF_ROLES.has(r)) return "/admin/dashboard";
  if (String(input.accountType || "").toLowerCase() === "alumni") return "/alumni/dashboard";
  return "/dashboard";
};

/**
 * Legacy helper: role only (no alumni discrimination). Prefer `getPostLoginDestination` after login.
 */
export const getDefaultRouteByRole = (role: string | undefined | null): string => {
  const r = normalizeRole(role);
  if (r === ALUMNI_ADMIN_ROLE) return "/admin/alumni";
  if (r === "student") return "/dashboard";
  if (!r) return "/dashboard";
  if (STAFF_ROLES.has(r)) return "/admin/dashboard";
  return "/dashboard";
};
