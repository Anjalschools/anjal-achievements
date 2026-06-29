/** Approved / legacy-approved achievements visible in public portfolio (independent of Hall of Fame flag). */
export const publicPortfolioPublishedAchievementFilter = (): Record<string, unknown> => ({
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
    {
      $or: [{ showInPublicPortfolio: { $ne: false } }, { showInPublicPortfolio: { $exists: false } }],
    },
  ],
});
