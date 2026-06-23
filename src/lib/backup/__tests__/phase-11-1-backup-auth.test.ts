import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({
  requireAdmin: vi.fn(),
}));

import { requireAdmin } from "@/lib/auth-guard";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";

describe("phase 11.1 — backup authorization", () => {
  it("restricts backup APIs to system administrator role", async () => {
    const mockedRequireAdmin = vi.mocked(requireAdmin);
    mockedRequireAdmin.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    } as never);

    const gate = await requireSystemAdmin();
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.response.status).toBe(403);
    }
  });

  it("allows admin role through system admin guard", async () => {
    const mockedRequireAdmin = vi.mocked(requireAdmin);
    mockedRequireAdmin.mockResolvedValueOnce({
      ok: true,
      user: { _id: "admin-id", role: "admin", name: "Admin" },
    } as never);

    const gate = await requireSystemAdmin();
    expect(gate.ok).toBe(true);
    if (gate.ok) {
      expect(gate.user.role).toBe("admin");
    }
  });
});
