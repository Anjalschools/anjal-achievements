import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/reports/achievement-participation",
  useSearchParams: () => new URLSearchParams(),
}));
