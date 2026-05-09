import type { NormalizedQuery } from "../query-normalizer";
import { createStubEmbeddingsProvider } from "./embeddings-provider";
import { rankWithSemanticBoost } from "./semantic-ranking";
import type { SearchHit } from "../global-search";

/**
 * Semantic-ready façade: today returns lexical hits unchanged.
 * Swap `createStubEmbeddingsProvider` + storage adapter without touching routes.
 */
export const semanticSearchOverlay = async (nq: NormalizedQuery, lexicalHits: SearchHit[]): Promise<SearchHit[]> => {
  if (!nq.raw.trim()) return lexicalHits;
  const provider = createStubEmbeddingsProvider();
  const [qEmb, docEmb] = await Promise.all([
    provider.embedTexts([nq.joined || nq.raw]),
    provider.embedTexts(lexicalHits.map((h) => `${h.title} ${h.subtitle}`)),
  ]);
  const queryEmbedding = qEmb[0] || [];
  if (!queryEmbedding.length) return lexicalHits;
  const candidates = lexicalHits.map((hit, i) => ({ hit, embedding: docEmb[i] || [] }));
  return rankWithSemanticBoost({ queryEmbedding, candidates });
};

export const smartSearchSuggestions = (): string[] => [
  "خريجو الأمن السيبراني في أرامكو",
  "مرشدون في الذكاء الاصطناعي",
  "خريجو KAUST",
  "فرص تدريب عن بُعد",
  "فعاليات التواصل لدفعة 2020",
];
