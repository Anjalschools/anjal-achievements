import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";

import { removeDrEventListener } from "@/lib/backup/backup-zip";

describe("backup-zip cleanup helpers", () => {
  it("removeDrEventListener uses removeListener when off is unavailable", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.on("end", listener);
    Reflect.deleteProperty(emitter as object, "off");

    removeDrEventListener(emitter, "end", listener);

    emitter.emit("end");
    expect(listener).not.toHaveBeenCalled();
  });

  it("removeDrEventListener is safe when called repeatedly", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.on("close", listener);

    removeDrEventListener(emitter, "close", listener);
    removeDrEventListener(emitter, "close", listener);

    emitter.emit("close");
    expect(listener).not.toHaveBeenCalled();
  });
});
