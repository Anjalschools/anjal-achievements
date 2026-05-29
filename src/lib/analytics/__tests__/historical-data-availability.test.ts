import { describe, expect, it } from "vitest";
import { assessHistoricalDataAvailability } from "@/lib/analytics/historical-data-availability";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";

describe("historical-data-availability", () => {
  it("detects partial signal with sparse years", () => {
    const report = assessHistoricalDataAvailability([
      {
        year: 2024,
        payload: {
          kpis: { totalParticipations: 3 },
          table: [{ totalParticipations: 3 } as HistoricalYearSlice["payload"]["table"][number]],
        } as HistoricalYearSlice["payload"],
      },
    ]);
    expect(report.hasPartialSignal).toBe(true);
    expect(report.availableYears).toContain(2024);
  });
});
