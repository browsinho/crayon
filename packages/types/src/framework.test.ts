import { describe, expect, it } from "vitest";
import { FrameworkInfoSchema, FrameworkTypeSchema } from "./framework.js";

describe("FrameworkTypeSchema", () => {
  it("accepts valid framework types", () => {
    expect(FrameworkTypeSchema.parse("react")).toBe("react");
    expect(FrameworkTypeSchema.parse("vue")).toBe("vue");
    expect(FrameworkTypeSchema.parse("angular")).toBe("angular");
    expect(FrameworkTypeSchema.parse("vanilla")).toBe("vanilla");
  });

  it("rejects invalid framework type", () => {
    expect(() => FrameworkTypeSchema.parse("svelte")).toThrow();
  });
});

describe("FrameworkInfoSchema", () => {
  it("accepts valid framework info", () => {
    const info = {
      framework: "react" as const,
      confidence: 0.95,
      signals: ["data-reactroot", "_reactRootContainer"],
    };
    expect(FrameworkInfoSchema.parse(info)).toEqual(info);
  });

  it("accepts vanilla with no signals", () => {
    const info = {
      framework: "vanilla" as const,
      confidence: 1.0,
      signals: [],
    };
    expect(FrameworkInfoSchema.parse(info)).toEqual(info);
  });

  it("rejects confidence below 0", () => {
    expect(() =>
      FrameworkInfoSchema.parse({
        framework: "react",
        confidence: -0.1,
        signals: [],
      })
    ).toThrow();
  });

  it("rejects confidence above 1", () => {
    expect(() =>
      FrameworkInfoSchema.parse({
        framework: "react",
        confidence: 1.5,
        signals: [],
      })
    ).toThrow();
  });
});
