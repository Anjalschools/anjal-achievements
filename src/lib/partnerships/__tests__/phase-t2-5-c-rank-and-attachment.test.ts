import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compareLeaderboardRankRows,
  computeStudentRankSummaryByAheadCount,
  computeStudentRankSummaryFromRows,
  sortLeaderboardRankRows,
  type RankableLeaderboardRow,
} from "@/lib/leaderboard-rank-utils";
import {
  attachmentDisplayUrl,
  isAttachmentDisplayUrlResolvable,
  resolveAttachmentDisplayUrl,
} from "@/lib/partnerships/attachment-display-url";

const makeRow = (
  userId: string,
  totalPoints: number,
  achievementsCount: number,
  latestAchievementDate: Date | null = null
): RankableLeaderboardRow => ({
  userId,
  totalPoints,
  achievementsCount,
  latestAchievementDate,
});

const buildDataset = (size: "small" | "medium" | "large"): RankableLeaderboardRow[] => {
  const count = size === "small" ? 8 : size === "medium" ? 120 : 500;
  const rows: RankableLeaderboardRow[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push(
      makeRow(
        `user-${String(i).padStart(4, "0")}`,
        (i * 7) % 97,
        (i * 3) % 11,
        new Date(Date.UTC(2024, (i % 12) + 1, (i % 27) + 1))
      )
    );
  }
  return rows;
};

describe("phase T.2.5.C — rank API stabilization", () => {
  it("sorts with identical tie-break order as legacy rank list", () => {
    const rows = [
      makeRow("a", 50, 3, new Date("2024-01-01")),
      makeRow("b", 60, 2, new Date("2024-02-01")),
      makeRow("c", 60, 2, new Date("2024-03-01")),
      makeRow("d", 60, 3, new Date("2024-01-15")),
    ];
    const sorted = sortLeaderboardRankRows(rows);
    expect(sorted.map((row) => row.userId)).toEqual(["d", "c", "b", "a"]);
  });

  it("matches ahead-count rank with legacy findIndex on small dataset", () => {
    const rows = buildDataset("small");
    const targetId = "user-0003";
    const legacy = computeStudentRankSummaryFromRows(rows, targetId);
    const optimized = computeStudentRankSummaryByAheadCount(rows, targetId);
    expect(optimized).toEqual(legacy);
  });

  it("matches ahead-count rank with legacy findIndex on medium dataset", () => {
    const rows = buildDataset("medium");
    const targetId = "user-0042";
    const legacy = computeStudentRankSummaryFromRows(rows, targetId);
    const optimized = computeStudentRankSummaryByAheadCount(rows, targetId);
    expect(optimized).toEqual(legacy);
  });

  it("matches ahead-count rank with legacy findIndex on large dataset", () => {
    const rows = buildDataset("large");
    const targetId = "user-0311";
    const legacy = computeStudentRankSummaryFromRows(rows, targetId);
    const optimized = computeStudentRankSummaryByAheadCount(rows, targetId);
    expect(optimized).toEqual(legacy);
  });

  it("returns null rank when student is not in ranked cohort", () => {
    const summary = computeStudentRankSummaryFromRows(buildDataset("small"), "missing-user");
    expect(summary.rank).toBeNull();
    expect(summary.totalPoints).toBe(0);
    expect(summary.totalRankedStudents).toBe(8);
  });

  it("uses userId asc as final tie-break", () => {
    const left = makeRow("000000000000000000000001", 10, 1, new Date("2024-05-01"));
    const right = makeRow("000000000000000000000002", 10, 1, new Date("2024-05-01"));
    expect(compareLeaderboardRankRows(left, right)).toBeLessThan(0);
  });

  it("uses leaderboard_student_rank_summary pipeline in service", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/leaderboard-service.ts", "utf8");
    expect(src).toContain("leaderboard_student_rank_summary");
    expect(src).toContain("$setWindowFields");
    expect(src).not.toContain("all.findIndex");
  });
});

describe("phase T.2.5.C — attachment preview URL resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns full public URL as-is (case A)", () => {
    const url = "https://cdn.example.com/reports/report.pdf";
    expect(attachmentDisplayUrl(url)).toBe(url);
    expect(resolveAttachmentDisplayUrl(url).resolvable).toBe(true);
  });

  it("returns Cloudinary URL as-is (case B)", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/report.png";
    expect(attachmentDisplayUrl(url)).toBe(url);
    expect(resolveAttachmentDisplayUrl(url).resolvable).toBe(true);
  });

  it("returns R2 public URL as-is (case C)", () => {
    const url = "https://assets.example.com/achievements/attachments/2025/01/file.pdf";
    expect(attachmentDisplayUrl(url)).toBe(url);
  });

  it("resolves bare R2 key with configured public base (case D)", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    const key = "achievements/attachments/2025/03/report.pdf";
    expect(attachmentDisplayUrl(key)).toBe("https://cdn.example.com/achievements/attachments/2025/03/report.pdf");
    expect(isAttachmentDisplayUrlResolvable(key)).toBe(true);
  });

  it("marks bare R2 key unresolvable when base URL missing (case D fallback)", () => {
    const key = "achievements/attachments/2025/03/report.pdf";
    const resolved = resolveAttachmentDisplayUrl(key);
    expect(resolved.url).toBe("");
    expect(resolved.resolvable).toBe(false);
    expect(resolved.reason).toBe("unconfigured_base");
  });

  it("handles missing file (case E)", () => {
    const resolved = resolveAttachmentDisplayUrl("");
    expect(resolved.url).toBe("");
    expect(resolved.resolvable).toBe(false);
    expect(resolved.reason).toBe("missing");
  });

  it("supports previewable image extensions after URL resolution", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    expect(attachmentDisplayUrl("achievements/attachments/2025/scan.PNG")).toContain(".PNG");
    expect(attachmentDisplayUrl("https://cdn.example.com/photo.jpg")).toBe("https://cdn.example.com/photo.jpg");
  });
});
