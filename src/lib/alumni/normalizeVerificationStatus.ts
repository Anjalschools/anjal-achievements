/**
 * Canonical alumni verification **request** statuses (tickets + legacy DB values).
 * Use everywhere filters, APIs, badges, or analytics compare verification request state.
 */

export type CanonicalVerificationRequestStatus = "approved" | "pending" | "rejected";

export type VerificationRequestListFilter = "all" | CanonicalVerificationRequestStatus;

const APPROVED_ALIASES = new Set([
  "approved",
  "verified",
  "active",
  "alumniapproved",
  "alumni_approved",
]);

/** Normalize any stored or query string to approved | pending | rejected. */
export const normalizeVerificationStatus = (raw: unknown): CanonicalVerificationRequestStatus => {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "rejected") return "rejected";
  if (s === "pending") return "pending";
  if (APPROVED_ALIASES.has(s)) return "approved";
  return "pending";
};

/** UI label for a verification **ticket** status (after {@link normalizeVerificationStatus}). */
export const getVerificationTicketStatusLabel = (raw: unknown, locale: "ar" | "en"): string => {
  const canonical = normalizeVerificationStatus(raw);
  if (canonical === "pending") return locale === "ar" ? "قيد المراجعة" : "Pending";
  if (canonical === "approved") return locale === "ar" ? "معتمد" : "Approved";
  return locale === "ar" ? "مرفوض" : "Rejected";
};

/** True when a stored {@link AlumniVerificationRequest} `status` still awaits admin review. */
export const isVerificationRequestPendingRaw = (raw: unknown): boolean =>
  normalizeVerificationStatus(raw) === "pending";

/** Parse `?status=` for admin lists (supports legacy UI values). */
export const parseVerificationRequestListStatusParam = (raw: string): VerificationRequestListFilter => {
  const s = String(raw || "all")
    .trim()
    .toLowerCase();
  if (s === "all") return "all";
  if (s === "verified" || s === "active" || s === "alumniapproved" || s === "alumni_approved") return "approved";
  if (s === "approved" || s === "pending" || s === "rejected") return s;
  return "all";
};

/** Mongo filter for {@link AlumniVerificationRequest} including legacy `status` strings. */
export const buildVerificationRequestStatusMongoFilter = (
  filter: VerificationRequestListFilter
): Record<string, unknown> => {
  if (filter === "all") return {};
  if (filter === "approved") {
    return { status: { $in: ["approved", "verified", "active", "alumniApproved", "alumniapproved", "alumni_approved"] } };
  }
  if (filter === "pending") return { status: "pending" };
  return { status: "rejected" };
};
