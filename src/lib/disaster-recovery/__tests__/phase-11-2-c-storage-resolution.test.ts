import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/r2", () => ({
  isR2Configured: vi.fn(() => true),
}));

vi.mock("@/lib/backup/backup-storage", () => ({
  resolveBackupStorageProvider: vi.fn((id: string) => ({
    id,
    storeStream: id === "r2" ? vi.fn() : undefined,
    store: vi.fn(),
    retrieve: vi.fn(),
  })),
}));

import { isR2Configured } from "@/lib/r2";
import { DisasterRecoveryBackupError } from "@/lib/disaster-recovery/dr-backup-logging";
import { resolveDisasterRecoveryStorageProvider } from "@/lib/disaster-recovery/dr-storage-resolution";

describe("phase 11.2.C — DR storage provider resolution", () => {
  beforeEach(() => {
    vi.mocked(isR2Configured).mockReturnValue(true);
  });

  it("resolves r2 for disaster recovery exports with objects", () => {
    const resolution = resolveDisasterRecoveryStorageProvider({
      requested: "r2",
      includeObjects: true,
      source: "test",
    });
    expect(resolution.resolved).toBe("r2");
    expect(resolution.usesStreamingUpload).toBe(true);
  });

  it("rejects local storage for disaster recovery exports with objects when r2 streaming is available", () => {
    expect(() =>
      resolveDisasterRecoveryStorageProvider({
        requested: "local",
        includeObjects: true,
        source: "test",
      })
    ).toThrow(DisasterRecoveryBackupError);

    try {
      resolveDisasterRecoveryStorageProvider({
        requested: "local",
        includeObjects: true,
        source: "test",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DisasterRecoveryBackupError);
      expect((error as DisasterRecoveryBackupError).message).toBe(
        "DISASTER_RECOVERY_STREAMING_STORAGE_REQUIRED"
      );
    }
  });

  it("allows local storage for database-only disaster recovery backups", () => {
    const resolution = resolveDisasterRecoveryStorageProvider({
      requested: "local",
      includeObjects: false,
      source: "test",
    });
    expect(resolution.resolved).toBe("local");
    expect(resolution.usesStreamingUpload).toBe(false);
  });

  it("fails object exports when r2 is not configured", () => {
    vi.mocked(isR2Configured).mockReturnValue(false);
    expect(() =>
      resolveDisasterRecoveryStorageProvider({
        requested: "r2",
        includeObjects: true,
        source: "test",
      })
    ).toThrow(DisasterRecoveryBackupError);
  });
});
