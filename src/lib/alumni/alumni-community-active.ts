/**
 * Alumni users visible in community counts, search, and public discovery.
 * Excludes admin soft-remove and permanent alumni identity purge.
 */
export const alumniCommunityActiveUserClause = (): Record<string, unknown> => ({
  $and: [
    { $or: [{ alumniCommunityRemovedAt: { $exists: false } }, { alumniCommunityRemovedAt: null }] },
    { $or: [{ alumniPermanentlyPurgedAt: { $exists: false } }, { alumniPermanentlyPurgedAt: null }] },
  ],
});
