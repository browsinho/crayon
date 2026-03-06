import { describe, expect, it } from "vitest";
import { SandboxSchema, SandboxStatusSchema, SandboxPortsSchema } from "./sandbox.js";

describe("SandboxStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(SandboxStatusSchema.parse("stopped")).toBe("stopped");
    expect(SandboxStatusSchema.parse("starting")).toBe("starting");
    expect(SandboxStatusSchema.parse("running")).toBe("running");
    expect(SandboxStatusSchema.parse("error")).toBe("error");
  });

  it("rejects invalid status", () => {
    expect(() => SandboxStatusSchema.parse("paused")).toThrow();
  });
});

describe("SandboxPortsSchema", () => {
  it("accepts valid ports", () => {
    const ports = { frontend: 3000, backend: 3001 };
    expect(SandboxPortsSchema.parse(ports)).toEqual(ports);
  });

  it("rejects non-positive ports", () => {
    expect(() => SandboxPortsSchema.parse({ frontend: 0, backend: 3001 })).toThrow();
    expect(() => SandboxPortsSchema.parse({ frontend: 3000, backend: -1 })).toThrow();
  });
});

describe("SandboxSchema", () => {
  it("accepts valid sandbox", () => {
    const sandbox = {
      id: "sandbox-001",
      status: "running" as const,
      ports: { frontend: 3000, backend: 3001 },
      url: "http://localhost:3000",
    };
    expect(SandboxSchema.parse(sandbox)).toEqual(sandbox);
  });

  it("accepts sandbox without url", () => {
    const sandbox = {
      id: "sandbox-001",
      status: "stopped" as const,
      ports: { frontend: 3000, backend: 3001 },
    };
    expect(SandboxSchema.parse(sandbox)).toEqual(sandbox);
  });
});
