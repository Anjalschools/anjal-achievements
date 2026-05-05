/**
 * Post-migration read-only verification: achievement `attachments[]` vs R2 public base URL.
 *
 *   npx tsx scripts/verify-achievement-media-migration.ts [--report] [--sample=10] [--strict] [--probe-head]
 *
 * - No Mongo writes.
 * - Default: URL/format checks only (no bulk network I/O).
 * - --probe-head: optional HEAD probe (limited) for https URLs under R2 base (requires network).
 */

import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  coerceAttachmentForStorage,
  extractAttachmentUrl,
  isNonRenderableAttachmentHref,
} from "../src/lib/achievement-attachments";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

type SlotCategory =
  | "migrated_ok"
  | "still_legacy"
  | "local_path"
  | "non_r2_https"
  | "missing_url"
  | "malformed"
  | "format_issue";

type SlotSample = {
  category: SlotCategory;
  achievementId: string;
  index: number;
  note?: string;
  urlPreview: string;
};

const parseArgs = (argv: string[]) => {
  const report = argv.includes("--report");
  const strict = argv.includes("--strict");
  const probeHead = argv.includes("--probe-head");
  let sample = 0;
  for (const a of argv) {
    if (a.startsWith("--sample=")) {
      const n = Number(a.slice("--sample=".length));
      if (Number.isFinite(n) && n >= 0) sample = Math.min(n, 500);
    }
  }
  return { report, sample, strict, probeHead };
};

const normalizePublicBase = (raw: string): string => raw.trim().replace(/\/+$/, "");

const safeUrlPreview = (url: string, max = 96): string => {
  const t = url.trim();
  if (!t) return "(empty)";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
};

const classifySlot = (
  item: unknown,
  index: number,
  r2BaseNorm: string
): { category: SlotCategory; coercedUrl: string; note?: string } => {
  void index;
  const coerced = coerceAttachmentForStorage(item);
  if (!coerced || !coerced.url.trim()) {
    const hasShape = item !== null && item !== undefined && item !== "";
    const cat: SlotCategory = hasShape ? "malformed" : "missing_url";
    return { category: cat, coercedUrl: "", note: hasShape ? "coerceAttachmentForStorage returned null" : undefined };
  }
  const url = coerced.url.trim();

  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return { category: "still_legacy", coercedUrl: url };
  }

  if (isNonRenderableAttachmentHref(url)) {
    return { category: "format_issue", coercedUrl: url, note: "non-renderable href (e.g. /api/)" };
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return { category: "local_path", coercedUrl: url };
  }

  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { category: "format_issue", coercedUrl: url, note: "unsupported protocol" };
      }
      if (u.protocol === "https:" && (url.startsWith(`${r2BaseNorm}/`) || url === r2BaseNorm)) {
        return { category: "migrated_ok", coercedUrl: url };
      }
      return {
        category: "non_r2_https",
        coercedUrl: url,
        note:
          u.protocol === "https:" && coerced.provider === "r2"
            ? "provider=r2 but URL does not start with R2_PUBLIC_BASE_URL (check custom domain / env mismatch)"
            : u.protocol === "http:"
              ? "http URL (expected https R2 public URL)"
              : undefined,
      };
    } catch {
      return { category: "malformed", coercedUrl: url, note: "URL.parse failed" };
    }
  }

  if (url.startsWith("//")) {
    return { category: "format_issue", coercedUrl: url, note: "protocol-relative URL" };
  }

  return { category: "malformed", coercedUrl: url, note: "unrecognized URL shape" };
};

const pushSample = (
  buckets: Record<SlotCategory, SlotSample[]>,
  sampleLimit: number,
  category: SlotCategory,
  row: SlotSample
) => {
  if (sampleLimit <= 0) return;
  const arr = buckets[category];
  if (arr.length < sampleLimit) arr.push(row);
};

const probeHeadLimited = async (urls: string[], limit: number): Promise<{ ok: number; fail: number; errors: string[] }> => {
  const errors: string[] = [];
  let ok = 0;
  let fail = 0;
  const slice = urls.slice(0, limit);
  for (const u of slice) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      const res = await fetch(u, { method: "HEAD", redirect: "follow", signal: ac.signal });
      clearTimeout(t);
      if (res.ok) ok += 1;
      else {
        fail += 1;
        errors.push(`${res.status} ${safeUrlPreview(u, 64)}`);
      }
    } catch (e) {
      fail += 1;
      errors.push(`${e instanceof Error ? e.message : String(e)} :: ${safeUrlPreview(u, 64)}`);
    }
  }
  return { ok, fail, errors };
};

async function main() {
  const { report, sample, strict, probeHead } = parseArgs(process.argv.slice(2));

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }

  const r2BaseRaw = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!r2BaseRaw) {
    console.error("R2_PUBLIC_BASE_URL is required to verify migrated URLs against your public R2 base.");
    process.exit(1);
  }
  const r2BaseNorm = normalizePublicBase(r2BaseRaw);

  const counts: Record<SlotCategory, number> = {
    migrated_ok: 0,
    still_legacy: 0,
    local_path: 0,
    non_r2_https: 0,
    missing_url: 0,
    malformed: 0,
    format_issue: 0,
  };

  let achievementsScanned = 0;
  let achievementsWithAttachments = 0;
  let attachmentSlotsTotal = 0;
  let docsWithAnyIssue = 0;

  const samples: Record<SlotCategory, SlotSample[]> = {
    migrated_ok: [],
    still_legacy: [],
    local_path: [],
    non_r2_https: [],
    missing_url: [],
    malformed: [],
    format_issue: [],
  };

  const probeCandidates: string[] = [];

  await mongoose.connect(uri, { dbName: "anjal_achievements" });
  const coll = mongoose.connection.collection("achievements");
  const cursor = coll.find({}, { projection: { attachments: 1 } });

  for await (const doc of cursor) {
    achievementsScanned += 1;
    const achievementId = String(doc._id);
    const attachments = doc.attachments;
    if (!Array.isArray(attachments) || attachments.length === 0) continue;

    achievementsWithAttachments += 1;
    let docHasIssue = false;

    attachments.forEach((item: unknown, index: number) => {
      attachmentSlotsTotal += 1;
      const rawUrl = extractAttachmentUrl(item);
      const { category, coercedUrl, note } = classifySlot(item, index, r2BaseNorm);
      counts[category] += 1;
      if (category !== "migrated_ok") docHasIssue = true;

      if (category !== "migrated_ok") {
        pushSample(samples, sample, category, {
          category,
          achievementId,
          index,
          note,
          urlPreview: safeUrlPreview(coercedUrl || rawUrl || "(none)"),
        });
      }

      if (probeHead && category === "migrated_ok" && coercedUrl.startsWith("https://")) {
        probeCandidates.push(coercedUrl);
      }
    });

    if (docHasIssue) docsWithAnyIssue += 1;
  }

  await mongoose.disconnect();

  let probeSummary: { ok: number; fail: number; attempted: number; errors: string[] } | null = null;
  if (probeHead) {
    const dedup = [...new Set(probeCandidates)].slice(0, 15);
    const r = await probeHeadLimited(dedup, dedup.length);
    probeSummary = { ok: r.ok, fail: r.fail, attempted: dedup.length, errors: r.errors.slice(0, 8) };
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    r2PublicBaseUrl: r2BaseNorm,
    achievementsScanned,
    achievementsWithAttachments,
    /** Total attachment array elements scanned (same as sum of slotCounts). */
    totalAttachmentSlotsChecked: attachmentSlotsTotal,
    docsWithAnyIssue,
    slotCounts: { ...counts },
    probeHead: probeSummary,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (sample > 0) {
    console.log("\n--- samples (by category) ---");
    for (const cat of Object.keys(samples) as SlotCategory[]) {
      const rows = samples[cat];
      if (rows.length === 0) continue;
      console.log(`\n[${cat}] (${rows.length} shown)`);
      for (const r of rows) {
        console.log(JSON.stringify(r));
      }
    }
  }

  if (report) {
    const dir = path.join(process.cwd(), "logs");
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "achievement-media-migration-verify-report.json");
    fs.writeFileSync(out, JSON.stringify({ ...summary, samples }, null, 2), "utf8");
    console.log(`\nReport written: ${out}`);
  }

  if (strict && (counts.still_legacy > 0 || counts.missing_url > 0 || counts.malformed > 0)) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
