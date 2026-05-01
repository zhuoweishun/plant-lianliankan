import { describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "Image",
  class FakeImage {
    private _src = "";
    public onload: null | (() => void) = null;
    public onerror: null | (() => void) = null;

    get src(): string {
      return this._src;
    }
    set src(v: string) {
      this._src = v;
      // 模拟浏览器：设置 src 后异步触发 onload
      queueMicrotask(() => this.onload?.());
    }
  },
);

describe("stickers", () => {
  it("stickerUrl uses BASE_URL prefix", async () => {
    const mod = await import("../src/ui/stickers.ts");
    expect(mod.stickerUrl("wood")).toMatch(/ui\/stickers\/wood\.png$/);
  });

  it("preloadStickers caches images", async () => {
    const mod = await import("../src/ui/stickers.ts");
    await mod.preloadStickers(["wood", "wood", "stone"]);
    expect(mod.getStickerImage("wood")).toBeTruthy();
    expect(mod.getStickerImage("stone")).toBeTruthy();
  });
});
