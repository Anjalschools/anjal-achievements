/** Payload from GET /api/user/public-portfolio — shared by profile page and card. */

export type UserPublicPortfolioPayload = {
  enabled: boolean;
  publicUrl: string | null;
  slug: string | null;
  token: string | null;
  qrValue: string | null;
  publishedAt: string | null;
};
