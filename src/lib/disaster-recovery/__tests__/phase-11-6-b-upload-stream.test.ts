import { PassThrough } from "stream";
import { describe, expect, it, vi } from "vitest";

import { monitorDrStream } from "@/lib/disaster-recovery/dr-stream-lifecycle";

describe("phase 11.6.B — DR upload stream lifecycle", () => {
  it("keeps upload body pristine while zip output is monitored", () => {
    const zipOutput = new PassThrough();
    const uploadBody = new PassThrough();
    zipOutput.pipe(uploadBody);

    expect(uploadBody.readableFlowing).toBeNull();

    monitorDrStream(zipOutput, { objectKey: "backup.zip", stage: "zip-upload" });

    expect(uploadBody.readableFlowing).toBeNull();
    expect(zipOutput.readableFlowing).not.toBeNull();
  });

  it("does not attach data listeners to upload body when only zip output is monitored", () => {
    const zipOutput = new PassThrough();
    const uploadBody = new PassThrough();
    zipOutput.pipe(uploadBody);

    monitorDrStream(zipOutput, { objectKey: "backup.zip", stage: "zip-upload" });

    expect(uploadBody.listenerCount("data")).toBe(0);
    expect(zipOutput.listenerCount("data")).toBeGreaterThan(0);
  });

  it("forwards zip bytes into upload body without pre-reading upload body", async () => {
    const zipOutput = new PassThrough();
    const uploadBody = new PassThrough();
    zipOutput.pipe(uploadBody);

    expect(uploadBody.readableFlowing).toBeNull();

    const readPromise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      uploadBody.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      uploadBody.on("end", () => resolve(Buffer.concat(chunks)));
      uploadBody.on("error", reject);
    });

    zipOutput.end(Buffer.from("zip-chunk"));
    const payload = await readPromise;

    expect(payload.toString()).toBe("zip-chunk");
  });
});
