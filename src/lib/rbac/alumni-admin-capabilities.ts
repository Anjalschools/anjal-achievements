/** Fine-grained alumni admin capabilities (mirrors keys on `APP_ROLE_MATRIX` for `alumniAdmin`). */
export const ALUMNI_ADMIN_CAPABILITY_KEYS = [
  "alumniStaffArea",
  "alumniManagement",
  "alumniReports",
  "alumniModeration",
  "alumniVerification",
  "alumniAnalytics",
  "alumniNetworking",
] as const;

export type AlumniAdminCapabilityKey = (typeof ALUMNI_ADMIN_CAPABILITY_KEYS)[number];
