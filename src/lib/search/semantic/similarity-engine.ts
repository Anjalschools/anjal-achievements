import type { EmbeddingVector } from "./embeddings-provider";

/** Cosine similarity placeholder — returns 0 until real vectors exist. */
export const cosineSimilarity = (a: EmbeddingVector, b: EmbeddingVector): number => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d > 0 ? dot / d : 0;
};
