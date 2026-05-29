import { describe, expect, it } from "vitest";
import {
  buildFocusedParticipantsTableLayout,
  FOCUSED_PARTICIPANTS_PAGE,
  resolveParticipantColumnRole,
} from "@/lib/analytics/export/focused-participants-pdf-layout-engine";

const AR_HEADERS = [
  "اسم الطالب",
  "الجنس",
  "القسم",
  "موهبة",
  "الصف",
  "المرحلة",
  "المدرسة",
  "النشاط",
  "السنة",
  "النتيجة",
  "المستوى",
  "الدرجة",
  "الاعتماد",
];

describe("focused-participants-pdf-layout-engine", () => {
  it("resolves Arabic column roles", () => {
    expect(resolveParticipantColumnRole("اسم الطالب")).toBe("studentName");
    expect(resolveParticipantColumnRole("الجنس")).toBe("gender");
    expect(resolveParticipantColumnRole("الاعتماد")).toBe("approval");
  });

  it("allocates the widest column to student name", () => {
    const plan = buildFocusedParticipantsTableLayout(AR_HEADERS);
    const nameCol = plan.columns.find((c) => c.role === "studentName");
    const genderCol = plan.columns.find((c) => c.role === "gender");
    expect(nameCol).toBeDefined();
    expect(genderCol).toBeDefined();
    expect(nameCol!.widthMm).toBeGreaterThan(genderCol!.widthMm);
  });

  it("fits table within printable landscape width", () => {
    const plan = buildFocusedParticipantsTableLayout(AR_HEADERS);
    expect(plan.tableWidthMm).toBeLessThanOrEqual(FOCUSED_PARTICIPANTS_PAGE.usableWidthMm + 0.5);
    expect(plan.colgroupHtml).toContain("<colgroup>");
    expect(plan.columns).toHaveLength(AR_HEADERS.length);
  });

  it("scales compact columns smaller than name and activity", () => {
    const plan = buildFocusedParticipantsTableLayout(AR_HEADERS);
    const activity = plan.columns.find((c) => c.role === "activity")!;
    const mawhiba = plan.columns.find((c) => c.role === "mawhiba")!;
    const name = plan.columns.find((c) => c.role === "studentName")!;
    expect(name.widthMm).toBeGreaterThan(activity.widthMm);
    expect(activity.widthMm).toBeGreaterThan(mawhiba.widthMm);
  });
});
