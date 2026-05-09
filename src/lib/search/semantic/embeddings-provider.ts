/**
 * Future: OpenAI / Cohere / local embeddings. No network I/O in Phase 6.
 */
export type EmbeddingVector = number[];

export type EmbeddingsProvider = {
  readonly id: string;
  embedTexts(_texts: string[]): Promise<EmbeddingVector[]>;
};

export const createStubEmbeddingsProvider = (): EmbeddingsProvider => ({
  id: "stub",
  async embedTexts(texts: string[]) {
    return texts.map(() => []);
  },
});
