import { describe, expect, it } from "vitest";
import { DOMSnapshotSchema, MutationSchema } from "./dom.js";

describe("MutationSchema", () => {
  it("accepts valid childList mutation", () => {
    const mutation = {
      type: "childList" as const,
      target: "#container",
      addedNodes: ["<div>New</div>"],
      removedNodes: [],
    };
    expect(MutationSchema.parse(mutation)).toEqual(mutation);
  });

  it("accepts valid attributes mutation", () => {
    const mutation = {
      type: "attributes" as const,
      target: "#button",
      attributeName: "class",
      oldValue: "btn",
      newValue: "btn active",
    };
    expect(MutationSchema.parse(mutation)).toEqual(mutation);
  });

  it("rejects invalid mutation type", () => {
    expect(() =>
      MutationSchema.parse({ type: "invalid", target: "#container" })
    ).toThrow();
  });
});

describe("DOMSnapshotSchema", () => {
  it("accepts valid full snapshot", () => {
    const snapshot = {
      id: "snap-001",
      timestamp: Date.now(),
      url: "https://example.com",
      type: "full" as const,
      html: "<html><body>Hello</body></html>",
      viewport: { width: 1920, height: 1080 },
    };
    expect(DOMSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("accepts valid diff snapshot", () => {
    const snapshot = {
      id: "snap-002",
      timestamp: Date.now(),
      url: "https://example.com",
      type: "diff" as const,
      mutations: [
        {
          type: "characterData" as const,
          target: "#text",
          oldValue: "Hello",
          newValue: "World",
        },
      ],
      viewport: { width: 1920, height: 1080 },
    };
    expect(DOMSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("rejects invalid snapshot type", () => {
    expect(() =>
      DOMSnapshotSchema.parse({
        id: "snap-001",
        timestamp: Date.now(),
        url: "https://example.com",
        type: "invalid",
        viewport: { width: 1920, height: 1080 },
      })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() =>
      DOMSnapshotSchema.parse({
        id: "snap-001",
        timestamp: Date.now(),
      })
    ).toThrow();
  });
});
