import type { SearchHit } from "../global-search";
import { cosineSimilarity } from "./similarity-engine";
import type { EmbeddingVector } from "./embeddings-provider";

export type SemanticRankInput = {
  queryEmbedding: EmbeddingVector;
  candidates: Array<{ hit: SearchHit; embedding: EmbeddingVector }>;
};

/** Merge lexical rankScore with semantic similarity once embeddings are wired. */
export const rankWithSemanticBoost = (input: SemanticRankInput, semanticWeight = 0.35): SearchHit[] => {
  const scored = input.candidates.map(({ hit, embedding }) => {
    const sim = cosineSimilarity(input.queryEmbedding, embedding);
    const blended = hit.rankScore * (1 - semanticWeight) + sim * 100 * semanticWeight;
    return { hit: { ...hit, rankScore: blended, rankHighlights: [...hit.rankHighlights, "semantic_ready"] }, blended };
  });
  return scored.sort((a, b) => b.blended - a.blended).map((x) => x.hit);
};
