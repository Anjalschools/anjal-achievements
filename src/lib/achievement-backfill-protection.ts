/**
 * Guards for legacy backfill: skip or limit changes on curated / admin-touched rows.
 */

export type AchievementBackfillProtectionRow = {
  status?: string;
  approved?: boolean;
  featured?: boolean;
  isFeatured?: boolean;
  showInHallOfFame?: boolean;
  lastEditedByRole?: string;
};

export type AchievementBackfillProtectionFlags = {
  isManuallyApproved: boolean;
  isFeatured: boolean;
  isHallOfFame: boolean;
  isAdminEdited: boolean;
};

export const resolveBackfillProtectionFlags = (
  row: AchievementBackfillProtectionRow
): AchievementBackfillProtectionFlags => {
  const status = String(row.status || "").trim();
  const isManuallyApproved =
    status === "approved" || row.approved === true;
  const isFeatured = row.featured === true || row.isFeatured === true;
  const isAdminEdited = String(row.lastEditedByRole || "").trim() === "admin";
  const isHallOfFame =
    isManuallyApproved && row.showInHallOfFame !== false;

  return {
    isManuallyApproved,
    isFeatured,
    isHallOfFame,
    isAdminEdited,
  };
};

export const isManuallyProtectedAchievement = (
  flags: AchievementBackfillProtectionFlags
): boolean =>
  flags.isManuallyApproved ||
  flags.isFeatured ||
  flags.isHallOfFame ||
  flags.isAdminEdited;
