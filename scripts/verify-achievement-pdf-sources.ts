/**
 * PDF source enumeration (Mongo object vs legacy string). No server-only imports.
 * Run: npx tsx scripts/verify-achievement-pdf-sources.ts
 */
import assert from "node:assert/strict";

import { listPdfAttachmentSourceDescriptors } from "../src/lib/achievement-attachment-pdf-sources";

const mawhibaLike = listPdfAttachmentSourceDescriptors({
  attachments: [
    {
      url: "https://storage.example.com/v1/blobs/8f3c2a1d",
      contentType: "application/pdf",
      fileName: "mawhiba_cert.pdf",
    },
  ],
});
assert.equal(mawhibaLike.length, 1, "object attachment with contentType + fileName yields one PDF source");
assert.equal(mawhibaLike[0]?.label, "attachment-1");

const groupListLike = listPdfAttachmentSourceDescriptors({
  attachments: [
    {
      url: "https://cdn.example.com/lists/roster?fmt=pdf&id=9",
      mimeType: "application/pdf",
      name: "class_list.pdf",
    },
  ],
});
assert.equal(groupListLike.length, 1, "group list PDF source detected");

const legacyStrings = listPdfAttachmentSourceDescriptors({
  attachments: ["https://x.com/a.pdf?token=1"],
});
assert.equal(legacyStrings.length, 1, "legacy string .pdf?query still detected");

// eslint-disable-next-line no-console
console.log("verify-achievement-pdf-sources: OK");
