import { describe, expect, it } from "vitest";
import { NetworkCallSchema, NetworkRequestSchema, NetworkResponseSchema } from "./network.js";

describe("NetworkRequestSchema", () => {
  it("accepts valid request", () => {
    const request = {
      method: "GET",
      url: "https://api.example.com/users",
      headers: { "Content-Type": "application/json" },
    };
    expect(NetworkRequestSchema.parse(request)).toEqual(request);
  });

  it("accepts request with body", () => {
    const request = {
      method: "POST",
      url: "https://api.example.com/users",
      headers: { "Content-Type": "application/json" },
      body: '{"name": "John"}',
    };
    expect(NetworkRequestSchema.parse(request)).toEqual(request);
  });

  it("rejects missing required fields", () => {
    expect(() => NetworkRequestSchema.parse({ method: "GET" })).toThrow();
  });
});

describe("NetworkResponseSchema", () => {
  it("accepts valid response", () => {
    const response = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: '{"id": 1}',
      contentType: "application/json",
    };
    expect(NetworkResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts response without body", () => {
    const response = {
      status: 204,
      headers: {},
      contentType: "text/plain",
    };
    expect(NetworkResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects non-integer status", () => {
    expect(() =>
      NetworkResponseSchema.parse({
        status: 200.5,
        headers: {},
        contentType: "text/plain",
      })
    ).toThrow();
  });
});

describe("NetworkCallSchema", () => {
  it("accepts valid network call", () => {
    const call = {
      id: "call-001",
      timestamp: Date.now(),
      request: {
        method: "GET",
        url: "https://api.example.com/users",
        headers: {},
      },
      response: {
        status: 200,
        headers: {},
        contentType: "application/json",
        body: "[]",
      },
    };
    expect(NetworkCallSchema.parse(call)).toEqual(call);
  });
});
