import { describe, expect, it } from "vitest";
import { WidgetInfoSchema, WidgetTypeSchema } from "./widget.js";

describe("WidgetTypeSchema", () => {
  it("accepts valid widget types", () => {
    expect(WidgetTypeSchema.parse("oauth-google")).toBe("oauth-google");
    expect(WidgetTypeSchema.parse("stripe")).toBe("stripe");
    expect(WidgetTypeSchema.parse("maps")).toBe("maps");
    expect(WidgetTypeSchema.parse("recaptcha")).toBe("recaptcha");
  });

  it("rejects invalid widget type", () => {
    expect(() => WidgetTypeSchema.parse("unknown")).toThrow();
  });
});

describe("WidgetInfoSchema", () => {
  it("accepts valid widget info", () => {
    const info = {
      type: "oauth-google" as const,
      selector: "[data-client_id]",
      provider: "google",
    };
    expect(WidgetInfoSchema.parse(info)).toEqual(info);
  });

  it("accepts stripe widget info", () => {
    const info = {
      type: "stripe" as const,
      selector: ".StripeElement",
      provider: "stripe",
    };
    expect(WidgetInfoSchema.parse(info)).toEqual(info);
  });

  it("accepts maps widget info", () => {
    const info = {
      type: "maps" as const,
      selector: ".gm-style",
      provider: "google",
    };
    expect(WidgetInfoSchema.parse(info)).toEqual(info);
  });

  it("accepts recaptcha widget info", () => {
    const info = {
      type: "recaptcha" as const,
      selector: ".g-recaptcha",
      provider: "google",
    };
    expect(WidgetInfoSchema.parse(info)).toEqual(info);
  });

  it("rejects missing required fields", () => {
    expect(() =>
      WidgetInfoSchema.parse({
        type: "stripe",
        selector: ".StripeElement",
      })
    ).toThrow();
  });
});
