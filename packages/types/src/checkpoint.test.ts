import { describe, expect, it } from "vitest";
import { CheckpointSchema, CookieSchema, BrowserStateSchema } from "./checkpoint.js";

describe("CookieSchema", () => {
  it("accepts valid cookie", () => {
    const cookie = {
      name: "session",
      value: "abc123",
      domain: "example.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Strict" as const,
    };
    expect(CookieSchema.parse(cookie)).toEqual(cookie);
  });

  it("accepts minimal cookie", () => {
    const cookie = {
      name: "session",
      value: "abc123",
    };
    expect(CookieSchema.parse(cookie)).toEqual(cookie);
  });
});

describe("BrowserStateSchema", () => {
  it("accepts valid browser state", () => {
    const state = {
      localStorage: { theme: "dark", user: "john" },
      cookies: [{ name: "session", value: "abc123" }],
    };
    expect(BrowserStateSchema.parse(state)).toEqual(state);
  });

  it("accepts empty state", () => {
    const state = {
      localStorage: {},
      cookies: [],
    };
    expect(BrowserStateSchema.parse(state)).toEqual(state);
  });
});

describe("CheckpointSchema", () => {
  it("accepts valid checkpoint", () => {
    const checkpoint = {
      id: "cp-001",
      name: "initial",
      createdAt: new Date(),
      databasePath: "/checkpoints/sandbox-001/initial/data.sqlite",
      browserState: {
        localStorage: {},
        cookies: [],
      },
    };
    const parsed = CheckpointSchema.parse(checkpoint);
    expect(parsed.id).toBe(checkpoint.id);
    expect(parsed.name).toBe(checkpoint.name);
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });

  it("coerces string date to Date", () => {
    const checkpoint = {
      id: "cp-001",
      name: "initial",
      createdAt: "2024-01-15T10:00:00Z",
      databasePath: "/checkpoints/sandbox-001/initial/data.sqlite",
      browserState: {
        localStorage: {},
        cookies: [],
      },
    };
    const parsed = CheckpointSchema.parse(checkpoint);
    expect(parsed.createdAt).toBeInstanceOf(Date);
  });
});
