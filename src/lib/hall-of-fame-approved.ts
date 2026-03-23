/**
 * Mongo match: achievements that count toward public Hall of Fame (approved only).
 * Aligns with legacy rows that use `approved` without `status`.
 */

export const hallOfFameApprovedAchievementFilter = (): Record<string, unknown> => ({
  $and: [
    {
      $or: [{ pendingReReview: { $ne: true } }, { pendingReReview: { $exists: false } }],
    },
    {
      $or: [
        { status: "approved" },
        {
          $and: [
            { approved: true },
            {
              $or: [{ status: { $exists: false } }, { status: null }, { status: "" }],
            },
          ],
        },
      ],
    },
    { status: { $ne: "rejected" } },
  ],
});
