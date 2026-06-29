import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase T.1.2.H UI root cause resolution", () => {
  it("uses portaled PartnershipMessageActionsMenu instead of Radix dropdown in bubble", () => {
    const bubbleSrc = readSrc("src/components/partnerships/PartnershipMessageBubble.tsx");
    const menuSrc = readSrc("src/components/partnerships/PartnershipMessageActionsMenu.tsx");

    expect(bubbleSrc).toContain("PartnershipMessageActionsMenu");
    expect(bubbleSrc).not.toContain("DropdownMenu");
    expect(menuSrc).toContain("createPortal");
    expect(menuSrc).toContain("document.body");
    expect(menuSrc).toContain('data-state="open"');
    expect(menuSrc).toContain("z-[99999]");
  });

  it("supports uiDebug inline isolation and production inline fallback", () => {
    const bubbleSrc = readSrc("src/components/partnerships/PartnershipMessageBubble.tsx");
    const adminPageSrc = readSrc("src/app/(app)/admin/partnerships/messages/page.tsx");

    expect(bubbleSrc).toContain("forceInlineDebug");
    expect(bubbleSrc).toContain("effectiveActionsMode");
    expect(bubbleSrc).toContain("renderInlineActions");
    expect(adminPageSrc).toContain('searchParams.get("uiDebug")');
  });

  it("shows emoji labels for edit delete restore in both modes", () => {
    const bubbleSrc = readSrc("src/components/partnerships/PartnershipMessageBubble.tsx");
    const menuSrc = readSrc("src/components/partnerships/PartnershipMessageActionsMenu.tsx");

    expect(bubbleSrc).toContain("✏️");
    expect(bubbleSrc).toContain("🗑");
    expect(bubbleSrc).toContain("↩");
    expect(menuSrc).toContain("role=\"menuitem\"");
  });
});

describe("Phase T.1.2.E message actions production validation", () => {
  it("falls back to inline actions on coarse pointer or narrow viewport", () => {
    const bubbleSrc = readSrc("src/components/partnerships/PartnershipMessageBubble.tsx");
    expect(bubbleSrc).toContain("(pointer: coarse)");
    expect(bubbleSrc).toContain("effectiveActionsMode");
    expect(bubbleSrc).toContain("renderInlineActions");
  });

  it("exposes messageActionsMode from messages API", () => {
    const routeSrc = readSrc("src/app/api/partnerships/messages/route.ts");
    const messagingSrc = readSrc("src/lib/partnerships/partnership-messaging-service.ts");
    expect(routeSrc).toContain("messageActionsMode");
    expect(routeSrc).toContain("getPartnershipProgramSettings");
    expect(messagingSrc).toContain("currentUserId");
    expect(messagingSrc).toContain("viewerRole");
  });

  it("passes permission flags through enrichMessagePermissions", () => {
    const serviceSrc = readSrc("src/lib/partnerships/partnership-message-mutation-service.ts");
    expect(serviceSrc).toContain("canEdit:");
    expect(serviceSrc).toContain("canDelete:");
    expect(serviceSrc).toContain("canRestore:");
    expect(serviceSrc).toContain("isMine:");
  });
});
