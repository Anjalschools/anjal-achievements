import { describe, expect, it, vi } from "vitest";

import {
  extractAwsSdkErrorFields,
  logAwsSendFailed,
} from "@/lib/disaster-recovery/dr-aws-sdk-diagnostics";

describe("phase 11.6.D — AWS SDK diagnostics", () => {
  it("extracts Smithy error metadata fields", () => {
    const root = new Error("An error was encountered in a non-retryable streaming request.");
    root.name = "TimeoutError";
    const cause = new Error("ECONNRESET");
    root.cause = cause;
    Object.assign(root, {
      $fault: "client",
      $retryable: false,
      Code: "ECONNRESET",
      $metadata: {
        httpStatusCode: 500,
        requestId: "req-123",
        extendedRequestId: "ext-456",
        cfId: "cf-ray-789",
      },
    });

    const fields = extractAwsSdkErrorFields(root);

    expect(fields.message).toContain("non-retryable streaming request");
    expect(fields.name).toBe("TimeoutError");
    expect(fields.cause).toBe(cause);
    expect(fields.causeDetails?.message).toBe("ECONNRESET");
    expect(fields.fault).toBe("client");
    expect(fields.retryable).toBe(false);
    expect(fields.code).toBe("ECONNRESET");
    expect(fields.statusCode).toBe(500);
    expect(fields.requestId).toBe("req-123");
    expect(fields.extendedRequestId).toBe("ext-456");
    expect(fields.cfRay).toBe("cf-ray-789");
  });

  it("logs AWS_SEND_FAILED and preserves the original error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const command = { constructor: { name: "PutObjectCommand" } };
    const rootError = new Error("ERR_STREAM_PREMATURE_CLOSE");

    expect(() => {
      logAwsSendFailed(command, "r2", rootError);
      throw rootError;
    }).toThrow(rootError);

    expect(errorSpy).toHaveBeenCalledWith(
      "[DR] AWS_SEND_FAILED",
      expect.objectContaining({
        command: "PutObjectCommand",
        provider: "r2",
        message: "ERR_STREAM_PREMATURE_CLOSE",
      })
    );
  });
});
