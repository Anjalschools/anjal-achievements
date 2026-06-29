export type PortfolioEvidenceCategory = "certificate" | "photo" | "document";

export type PortfolioEvidenceKind = "image" | "pdf" | "document";

export type PublicPortfolioEvidenceItem = {
  ref: string;
  name: string;
  kind: PortfolioEvidenceKind;
  category: PortfolioEvidenceCategory;
  mimeType: string;
  sizeBytes?: number;
};
