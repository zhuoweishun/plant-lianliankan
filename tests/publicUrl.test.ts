import { describe, expect, it } from "vitest";

describe("publicUrl", () => {
  it("appends path to BASE_URL", async () => {
    const { publicUrl } = await import("../src/ui/publicUrl.ts");
    expect(publicUrl("ui/stickers/wood.png")).toMatch(/ui\/stickers\/wood\.png$/);
  });
});

