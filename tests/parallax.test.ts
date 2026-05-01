import { describe, expect, it, vi } from "vitest";

class FakeStyle {
  private readonly map = new Map<string, string>();
  setProperty(k: string, v: string) {
    this.map.set(k, v);
  }
  getPropertyValue(k: string) {
    return this.map.get(k) ?? "";
  }
}

class FakeEl {
  clientWidth = 100;
  clientHeight = 100;
  style = new FakeStyle();
  private listeners = new Map<string, ((e: any) => void)[]>();
  addEventListener(type: string, cb: (e: any) => void) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(cb);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: string, cb: (e: any) => void) {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      arr.filter((x) => x !== cb),
    );
  }
  dispatch(type: string, e: any) {
    for (const cb of this.listeners.get(type) ?? []) cb(e);
  }
}

describe("parallax", () => {
  it("updates css vars on pointer move", async () => {
    // 默认不 reduce motion
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const { attachParallax } = await import("../src/ui/parallax.ts");

    const el = new FakeEl() as unknown as HTMLElement;

    const detach = attachParallax(el, { strengthPx: 12 });

    (el as unknown as FakeEl).dispatch("pointermove", { clientX: 100, clientY: 0 });
    await new Promise((r) => setTimeout(r, 0));

    expect(el.style.getPropertyValue("--px1")).toBeTruthy();
    expect(el.style.getPropertyValue("--py1")).toBeTruthy();

    detach();
  });

  it("does nothing when prefers-reduced-motion is enabled", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const { attachParallax } = await import("../src/ui/parallax.ts");
    const el = new FakeEl() as unknown as HTMLElement;
    const detach = attachParallax(el, { strengthPx: 12 });
    detach();
    expect(el.style.getPropertyValue("--px1")).toBe("");
  });
});
