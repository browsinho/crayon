import { describe, expect, it } from "vitest";
import { ScreenshotSchema } from "./screenshot.js";

describe("ScreenshotSchema", () => {
  it("accepts valid screenshot", () => {
    const screenshot = {
      id: "ss-001",
      domSnapshotId: "snap-001",
      timestamp: Date.now(),
      path: "/screenshots/ss-001.png",
      width: 1920,
      height: 1080,
    };
    expect(ScreenshotSchema.parse(screenshot)).toEqual(screenshot);
  });

  it("rejects non-positive dimensions", () => {
    expect(() =>
      ScreenshotSchema.parse({
        id: "ss-001",
        domSnapshotId: "snap-001",
        timestamp: Date.now(),
        path: "/screenshots/ss-001.png",
        width: 0,
        height: 1080,
      })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() =>
      ScreenshotSchema.parse({
        id: "ss-001",
        timestamp: Date.now(),
      })
    ).toThrow();
  });
});
