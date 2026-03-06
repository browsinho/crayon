import { describe, expect, it } from "vitest";
import {
  BrowserSessionSchema,
  BrowserSessionStatusSchema,
  ViewportSchema,
} from "./browser.js";

describe("BrowserSessionStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(BrowserSessionStatusSchema.parse("active")).toBe("active");
    expect(BrowserSessionStatusSchema.parse("stopped")).toBe("stopped");
    expect(BrowserSessionStatusSchema.parse("error")).toBe("error");
  });

  it("rejects invalid statuses", () => {
    expect(() => BrowserSessionStatusSchema.parse("invalid")).toThrow();
    expect(() => BrowserSessionStatusSchema.parse("")).toThrow();
  });
});

describe("ViewportSchema", () => {
  it("accepts valid viewports", () => {
    const viewport = { width: 1920, height: 1080 };
    expect(ViewportSchema.parse(viewport)).toEqual(viewport);
  });

  it("rejects non-positive dimensions", () => {
    expect(() => ViewportSchema.parse({ width: 0, height: 1080 })).toThrow();
    expect(() => ViewportSchema.parse({ width: 1920, height: -1 })).toThrow();
  });

  it("rejects non-integer dimensions", () => {
    expect(() => ViewportSchema.parse({ width: 1920.5, height: 1080 })).toThrow();
  });
});

describe("BrowserSessionSchema", () => {
  it("accepts valid browser session", () => {
    const session = {
      id: "session-123",
      status: "active" as const,
      cdpUrl: "ws://localhost:9222/devtools/browser/abc",
    };
    expect(BrowserSessionSchema.parse(session)).toEqual(session);
  });

  it("rejects missing fields", () => {
    expect(() => BrowserSessionSchema.parse({ id: "123" })).toThrow();
    expect(() =>
      BrowserSessionSchema.parse({ id: "123", status: "active" })
    ).toThrow();
  });
});
