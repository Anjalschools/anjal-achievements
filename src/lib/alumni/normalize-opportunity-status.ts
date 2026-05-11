export type CanonicalOpportunityStatus = "pending_review" | "approved" | "rejected" | "archived";

export const normalizeOpportunityStatus = (row: {
  archivedAt?: Date | null;
  published?: boolean;
  reviewStatus?: string | null;
}): CanonicalOpportunityStatus => {
  if (row.archivedAt != null) return "archived";
  const rs = String(row.reviewStatus || "").trim();
  if (rs === "pending_review" || rs === "approved" || rs === "rejected" || rs === "archived") {
    return rs as CanonicalOpportunityStatus;
  }
  if (row.published === true) return "approved";
  return "pending_review";
};

/** Mongo filter: opportunities visible on public listings and global search. */
export const publicApprovedOpportunityClause = (): Record<string, unknown> => ({
  published: true,
  $or: [{ reviewStatus: { $exists: false } }, { reviewStatus: null }, { reviewStatus: "approved" }],
});

export const publicAlumniOpportunityListingFilter = (now: Date = new Date()): Record<string, unknown> => ({
  ...publicApprovedOpportunityClause(),
  $and: [
    { $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }] },
    {
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }],
    },
  ],
});

type LeanOpp = {
  published?: boolean;
  archivedAt?: Date | null;
  reviewStatus?: string | null;
};

export const isOpportunityPubliclyVisible = (row: LeanOpp): boolean =>
  normalizeOpportunityStatus(row) === "approved";
