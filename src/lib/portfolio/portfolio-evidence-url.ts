export const buildPortfolioEvidenceUrl = (input: {
  slug: string;
  token: string;
  ref: string;
  disposition?: "inline" | "attachment";
}): string => {
  const params = new URLSearchParams({
    slug: input.slug,
    token: input.token,
    ref: input.ref,
    disposition: input.disposition ?? "inline",
  });
  return `/api/public/portfolio/evidence?${params.toString()}`;
};
