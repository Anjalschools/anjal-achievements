/**
 * Alumni users visible in community counts, search, and public discovery.
 * Excludes admin soft-remove and permanent alumni identity purge.
 * Defensive: also excludes soft-deleted user rows when those fields exist on documents.
 */
export const alumniCommunityActiveUserClause = (): Record<string, unknown> => ({
  $and: [
    { $or: [{ alumniCommunityRemovedAt: { $exists: false } }, { alumniCommunityRemovedAt: null }] },
    { $or: [{ alumniPermanentlyPurgedAt: { $exists: false } }, { alumniPermanentlyPurgedAt: null }] },
    { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
    { $nor: [{ isDeleted: true }] },
  ],
});
