/**
 * How a verified alumni row reached its state — for admin verification center badges.
 * - `request`: formal ticket in {@link AlumniVerificationRequest}
 * - `manual`: admin panel / legacy `admin` source
 * - `auto`: imported, legacy default, LinkedIn, university email, career path, etc.
 */
export type AlumniVerificationChannel = "request" | "manual" | "auto";

export const getAlumniVerificationChannel = (row: {
  isProfileOnly?: boolean;
  verificationSource?: string | null;
}): AlumniVerificationChannel => {
  if (!row.isProfileOnly) return "request";
  const s = String(row.verificationSource || "").toLowerCase();
  if (s === "verification_request") return "request";
  if (s === "admin" || s === "manual_admin") return "manual";
  return "auto";
};
