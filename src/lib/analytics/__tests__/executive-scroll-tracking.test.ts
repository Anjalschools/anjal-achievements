import { describe, expect, it } from "vitest";
import { scrollToExecutiveAnchor } from "@/lib/analytics/executive-scroll-tracking";

describe("executive-scroll-tracking", () => {
  it("scrollToExecutiveAnchor is safe when element missing", () => {
    expect(() => scrollToExecutiveAnchor("missing-anchor-id")).not.toThrow();
  });
});
