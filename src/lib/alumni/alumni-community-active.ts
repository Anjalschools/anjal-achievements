/**
 * Alumni users visible in community counts, search, and public discovery.
 * Rows with `alumniCommunityRemovedAt` set are excluded (admin soft-remove).
 */
export const alumniCommunityActiveUserClause = (): Record<string, unknown> => ({
  $or: [{ alumniCommunityRemovedAt: { $exists: false } }, { alumniCommunityRemovedAt: null }],
});
