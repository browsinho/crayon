import { describe, expect, it } from "vitest";
import { APIRouteSchema, APIRoutePatternSchema } from "./api.js";

describe("APIRoutePatternSchema", () => {
  it("accepts valid patterns", () => {
    expect(APIRoutePatternSchema.parse("list")).toBe("list");
    expect(APIRoutePatternSchema.parse("get")).toBe("get");
    expect(APIRoutePatternSchema.parse("create")).toBe("create");
    expect(APIRoutePatternSchema.parse("update")).toBe("update");
    expect(APIRoutePatternSchema.parse("delete")).toBe("delete");
    expect(APIRoutePatternSchema.parse("custom")).toBe("custom");
  });

  it("rejects invalid pattern", () => {
    expect(() => APIRoutePatternSchema.parse("fetch")).toThrow();
  });
});

describe("APIRouteSchema", () => {
  it("accepts valid list route", () => {
    const route = {
      method: "GET",
      path: "/api/users",
      pattern: "list" as const,
      responseSchema: {
        type: "array",
        items: { type: "object" },
      },
      examples: [{ response: [{ id: 1, name: "John" }] }],
    };
    expect(APIRouteSchema.parse(route)).toEqual(route);
  });

  it("accepts valid get route with request schema", () => {
    const route = {
      method: "GET",
      path: "/api/users/:id",
      pattern: "get" as const,
      requestSchema: {
        type: "object",
        properties: { id: { type: "string" } },
      },
      responseSchema: {
        type: "object",
        properties: { id: { type: "number" }, name: { type: "string" } },
      },
      examples: [
        {
          request: { id: "1" },
          response: { id: 1, name: "John" },
        },
      ],
    };
    expect(APIRouteSchema.parse(route)).toEqual(route);
  });

  it("accepts route with empty examples", () => {
    const route = {
      method: "DELETE",
      path: "/api/users/:id",
      pattern: "delete" as const,
      examples: [],
    };
    expect(APIRouteSchema.parse(route)).toEqual(route);
  });
});
