/**
 * Search-ready indexing notes (MongoDB). Apply in production via migration or Compass.
 *
 * Suggested compound indexes (alumni discovery):
 * - { accountType: 1, "alumniProfile.universityName": 1 }
 * - { accountType: 1, "alumniProfile.industry": 1 }
 * - { accountType: 1, "alumniProfile.graduationYear": 1 }
 *
 * Optional text index (when Atlas/Mongo supports it for your deployment):
 * - Text on fullName + alumniProfile.universityName + major + currentCompany + industry
 *   with partialFilterExpression: { accountType: "alumni" }
 *
 * Current runtime queries use regex + selective match — keep result limits modest.
 */

export const SEARCH_INDEX_VERSION = 1;

export const describeAlumniSearchIndexes = (): string =>
  [
    "User: { accountType: 1, alumniProfile.universityName: 1 }",
    "User: { accountType: 1, alumniProfile.industry: 1 }",
    "AlumniOpportunity: { published: 1, title: 1 }",
    "AlumniReunionEvent: { published: 1, startsAt: -1 }",
  ].join("\n");
