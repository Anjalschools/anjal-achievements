/** Lightweight abuse guard — extend with provider moderation later. */
const BLOCKLIST = [
  "ignore previous",
  "system prompt",
  "jailbreak",
  "delete all",
  "sql injection",
  "<script",
  "password",
  "credit card",
];

export const moderateAlumniUserText = (text: string): { ok: true } | { ok: false; reason: string } => {
  const t = text.toLowerCase();
  if (text.length > 12_000) return { ok: false, reason: "too_long" };
  for (const b of BLOCKLIST) {
    if (t.includes(b)) return { ok: false, reason: "blocked_pattern" };
  }
  return { ok: true };
};
