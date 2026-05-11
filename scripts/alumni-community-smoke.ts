/**
 * Alumni community smoke checks (no DB, no HTTP server).
 * Run: npm run verify:alumni-community-smoke
 */
import assert from "node:assert/strict";
import {
  normalizeVerificationStatus,
  buildVerificationRequestStatusMongoFilter,
  getVerificationTicketStatusLabel,
} from "../src/lib/alumni/normalizeVerificationStatus";
import { getVerificationSourceLabel } from "../src/lib/alumni/verification-source-label";
import { buildAlumniSearchRegexPattern, normalizeAlumniSearchToken } from "../src/lib/alumni/arabic-search-normalize";
import { stripHtmlNoiseForEmptyCheck, alumniStoryBodyHasVisibleText } from "../src/lib/alumni/alumni-story-input";
import { slugifyWithTransliterationFallback, randomSlugCollisionSuffix } from "../src/lib/alumni/slugify";
import { invalidateAlumniSummaryCache } from "../src/lib/alumni/alumni-public-cache";
import {
  alumniMemoryImageFingerprint,
  hasRecentDuplicateMemoryPost,
} from "../src/lib/alumni/alumni-memory-dedupe";

assert.equal(normalizeVerificationStatus("verified"), "approved");
assert.equal(normalizeVerificationStatus("alumni_approved"), "approved");
assert.equal(normalizeVerificationStatus("pending"), "pending");
assert.equal(normalizeVerificationStatus("rejected"), "rejected");
assert.equal(getVerificationTicketStatusLabel("verified", "en"), "Approved");
assert.equal(getVerificationTicketStatusLabel("pending", "ar"), "قيد المراجعة");

const approvedFilter = buildVerificationRequestStatusMongoFilter("approved") as { status: { $in: string[] } };
assert.ok(Array.isArray(approvedFilter.status.$in));
assert.ok(approvedFilter.status.$in.includes("verified"));

assert.ok(getVerificationSourceLabel("manual_admin", "ar").includes("يدوي"));
assert.ok(getVerificationSourceLabel("verification_request", "ar").includes("طلب"));
assert.ok(getVerificationSourceLabel("imported", "en").toLowerCase().includes("import"));
assert.ok(getVerificationSourceLabel("legacy", "en").toLowerCase().includes("legacy"));

const pat = buildAlumniSearchRegexPattern(normalizeAlumniSearchToken("احمد"));
assert.ok(pat.length > 0);
assert.match("أحمد محمد", new RegExp(pat, "u"));
assert.equal(normalizeAlumniSearchToken("  ١٢٣  "), "123");

const noisyHtml = "<!--note--><p>\u00A0\u2007\u200C\uFEFF</p>";
assert.equal(alumniStoryBodyHasVisibleText(noisyHtml), false);
const strippedNoise = stripHtmlNoiseForEmptyCheck(noisyHtml);
assert.ok(!strippedNoise.includes("<") && !strippedNoise.includes("<!--"), "HTML shell stripped before empty check");

const slugAr = slugifyWithTransliterationFallback("محاضرة توعوية");
assert.ok(slugAr.replace(/-/g, "").length >= 2);
const suf = randomSlugCollisionSuffix();
assert.ok(suf.length >= 6 && suf.length <= 12);

const fp = alumniMemoryImageFingerprint("https://cdn.example.com/v123/folder/sample.jpg");
assert.ok(fp.includes("sample.jpg"));
const dup = hasRecentDuplicateMemoryPost(
  [
    {
      status: "pending",
      caption: "Hello",
      memoryYear: 2020,
      imageUrl: "https://cdn.example.com/a/b/c/x.jpg",
      submittedAt: new Date(),
    },
  ],
  { caption: "Hello", memoryYear: 2020, imageUrl: "https://cdn.example.com/a/b/c/x.jpg" }
);
assert.equal(dup, true);

const prevDebug = process.env.ALUMNI_DEBUG;
const captured: unknown[][] = [];
const origInfo = console.info;
console.info = (...args: unknown[]) => {
  captured.push(args);
  origInfo(...args);
};
process.env.ALUMNI_DEBUG = "1";
invalidateAlumniSummaryCache("smoke:alumni-community-script");
console.info = origInfo;
process.env.ALUMNI_DEBUG = prevDebug;

const cacheLine = captured.find((a) => String(a[0]).includes("[alumni-cache-invalidated]"));
assert.ok(cacheLine, "expected [alumni-cache-invalidated] log when ALUMNI_DEBUG=1");
const payload = cacheLine[1] as { reason?: string; timestamp?: string };
assert.equal(payload.reason, "smoke:alumni-community-script");
assert.ok(typeof payload.timestamp === "string" && payload.timestamp.length > 10);

console.log("OK: alumni-community-smoke");
