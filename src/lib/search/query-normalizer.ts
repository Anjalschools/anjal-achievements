/** Shared tokenization for Mongo-safe search (no external search engine). */

import { normalizeAlumniSearchToken } from "@/lib/alumni/arabic-search-normalize";

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type NormalizedQuery = {
  raw: string;
  tokens: string[];
  joined: string;
};

export const normalizeSearchQuery = (input: string | null | undefined): NormalizedQuery => {
  const raw = String(input || "").trim();
  if (!raw) return { raw: "", tokens: [], joined: "" };
  const tokens = raw
    .split(/[\s,،؛]+/u)
    .map((t) => normalizeAlumniSearchToken(t.trim()))
    .filter((t) => t.length >= 2)
    .slice(0, 14);
  return { raw, tokens, joined: tokens.join(" ").toLowerCase() };
};
