/**
 * Fallback when `router.back()` has no meaningful history (e.g. deep-linked).
 * Keeps alumni users inside the authenticated dashboard shell.
 */
export const ALUMNI_DASHBOARD_FALLBACK_HREF = "/alumni/dashboard" as const;
