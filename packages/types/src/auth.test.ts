import { describe, expect, it } from "vitest";
import { AuthInfoSchema, AuthTypeSchema, FormAuthSchema, TokenAuthSchema } from "./auth.js";

describe("AuthTypeSchema", () => {
  it("accepts valid auth types", () => {
    expect(AuthTypeSchema.parse("form")).toBe("form");
    expect(AuthTypeSchema.parse("oauth")).toBe("oauth");
    expect(AuthTypeSchema.parse("token")).toBe("token");
    expect(AuthTypeSchema.parse("none")).toBe("none");
  });

  it("rejects invalid auth type", () => {
    expect(() => AuthTypeSchema.parse("basic")).toThrow();
  });
});

describe("FormAuthSchema", () => {
  it("accepts valid form auth", () => {
    const form = {
      loginUrl: "/login",
      usernameField: "email",
      passwordField: "password",
    };
    expect(FormAuthSchema.parse(form)).toEqual(form);
  });
});

describe("TokenAuthSchema", () => {
  it("accepts valid token auth", () => {
    const token = {
      headerName: "Authorization",
      storage: "localStorage" as const,
    };
    expect(TokenAuthSchema.parse(token)).toEqual(token);
  });

  it("accepts cookie storage", () => {
    const token = {
      headerName: "X-Auth-Token",
      storage: "cookie" as const,
    };
    expect(TokenAuthSchema.parse(token)).toEqual(token);
  });
});

describe("AuthInfoSchema", () => {
  it("accepts form auth info", () => {
    const auth = {
      type: "form" as const,
      form: {
        loginUrl: "/login",
        usernameField: "email",
        passwordField: "password",
      },
    };
    expect(AuthInfoSchema.parse(auth)).toEqual(auth);
  });

  it("accepts oauth auth info", () => {
    const auth = {
      type: "oauth" as const,
      oauth: {
        provider: "google" as const,
        buttonSelector: ".google-login-btn",
      },
    };
    expect(AuthInfoSchema.parse(auth)).toEqual(auth);
  });

  it("accepts token auth info", () => {
    const auth = {
      type: "token" as const,
      token: {
        headerName: "Authorization",
        storage: "localStorage" as const,
      },
    };
    expect(AuthInfoSchema.parse(auth)).toEqual(auth);
  });

  it("accepts none auth type", () => {
    const auth = {
      type: "none" as const,
    };
    expect(AuthInfoSchema.parse(auth)).toEqual(auth);
  });
});
