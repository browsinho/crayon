/**
 * Tests for Sandbox Hosting
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SandboxHosting, SandboxHostingError, createSandboxHosting } from "./sandbox-hosting.js";
import { SandboxManager } from "./sandbox-manager.js";
import type { Sandbox } from "@crayon/types";

describe("SandboxHosting", () => {
  let sandboxHosting: SandboxHosting;
  let mockSandboxManager: SandboxManager;

  beforeEach(() => {
    // Create a mock sandbox manager
    mockSandboxManager = {
      start: vi.fn(),
      stop: vi.fn(),
      getStatus: vi.fn(),
      list: vi.fn(),
    } as unknown as SandboxManager;

    sandboxHosting = new SandboxHosting({
      baseUrl: "http://localhost:3000",
      sandboxManager: mockSandboxManager,
    });
  });

  describe("createSandboxHosting", () => {
    it("should create a SandboxHosting instance", () => {
      const hosting = createSandboxHosting({
        baseUrl: "http://localhost:3000",
      });
      expect(hosting).toBeInstanceOf(SandboxHosting);
    });
  });

  describe("startHosting", () => {
    it("should start hosting a sandbox and return host info", async () => {
      const mockSandbox: Sandbox = {
        id: "test-sandbox",
        status: "running",
        ports: { frontend: 3010, backend: 3011 },
        url: "http://localhost:3010",
      };

      vi.mocked(mockSandboxManager.start).mockResolvedValue(mockSandbox);

      const result = await sandboxHosting.startHosting("test-sandbox");

      expect(result).toEqual({
        sandboxId: "test-sandbox",
        url: "http://localhost:3000/api/sandbox/test-sandbox/proxy",
        status: "running",
        container: {
          id: "crayon-sandbox-test-sandbox",
          ports: {
            frontend: 3010,
            backend: 3011,
          },
        },
      });

      expect(mockSandboxManager.start).toHaveBeenCalledWith("test-sandbox");
    });

    it("should handle starting status as running", async () => {
      const mockSandbox: Sandbox = {
        id: "test-sandbox",
        status: "starting",
        ports: { frontend: 3010, backend: 3011 },
      };

      vi.mocked(mockSandboxManager.start).mockResolvedValue(mockSandbox);

      const result = await sandboxHosting.startHosting("test-sandbox");

      expect(result.status).toBe("running");
    });

    it("should throw error if sandbox manager fails", async () => {
      vi.mocked(mockSandboxManager.start).mockRejectedValue(new Error("Docker error"));

      await expect(sandboxHosting.startHosting("test-sandbox")).rejects.toThrow(
        SandboxHostingError
      );
      await expect(sandboxHosting.startHosting("test-sandbox")).rejects.toThrow(
        "Failed to start hosting sandbox"
      );
    });
  });

  describe("stopHosting", () => {
    it("should stop hosting a sandbox", async () => {
      vi.mocked(mockSandboxManager.stop).mockResolvedValue(undefined);

      await sandboxHosting.stopHosting("test-sandbox");

      expect(mockSandboxManager.stop).toHaveBeenCalledWith("test-sandbox");
    });

    it("should throw error if sandbox manager fails", async () => {
      vi.mocked(mockSandboxManager.stop).mockRejectedValue(new Error("Not found"));

      await expect(sandboxHosting.stopHosting("test-sandbox")).rejects.toThrow(
        SandboxHostingError
      );
      await expect(sandboxHosting.stopHosting("test-sandbox")).rejects.toThrow(
        "Failed to stop hosting sandbox"
      );
    });
  });

  describe("getSandboxUrl", () => {
    it("should generate correct proxy URL for sandbox", () => {
      const url = sandboxHosting.getSandboxUrl("test-sandbox");
      expect(url).toBe("http://localhost:3000/api/sandbox/test-sandbox/proxy");
    });

    it("should work with different base URLs", () => {
      const hosting = new SandboxHosting({
        baseUrl: "https://crayon.example.com",
        sandboxManager: mockSandboxManager,
      });

      const url = hosting.getSandboxUrl("my-sandbox");
      expect(url).toBe("https://crayon.example.com/api/sandbox/my-sandbox/proxy");
    });
  });

  describe("listHosted", () => {
    it("should list all hosted sandboxes", async () => {
      const mockSandboxes: Sandbox[] = [
        {
          id: "sandbox-1",
          status: "running",
          ports: { frontend: 3010, backend: 3011 },
          url: "http://localhost:3010",
        },
        {
          id: "sandbox-2",
          status: "stopped",
          ports: { frontend: 3020, backend: 3021 },
        },
      ];

      vi.mocked(mockSandboxManager.list).mockResolvedValue(mockSandboxes);

      const result = await sandboxHosting.listHosted();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sandboxId: "sandbox-1",
        url: "http://localhost:3000/api/sandbox/sandbox-1/proxy",
        status: "running",
        container: {
          id: "crayon-sandbox-sandbox-1",
          ports: {
            frontend: 3010,
            backend: 3011,
          },
        },
      });
      expect(result[1]).toEqual({
        sandboxId: "sandbox-2",
        url: "http://localhost:3000/api/sandbox/sandbox-2/proxy",
        status: "stopped",
        container: {
          id: "crayon-sandbox-sandbox-2",
          ports: {
            frontend: 3020,
            backend: 3021,
          },
        },
      });
    });

    it("should return empty array if no sandboxes", async () => {
      vi.mocked(mockSandboxManager.list).mockResolvedValue([]);

      const result = await sandboxHosting.listHosted();

      expect(result).toEqual([]);
    });

    it("should throw error if listing fails", async () => {
      vi.mocked(mockSandboxManager.list).mockRejectedValue(new Error("Docker error"));

      await expect(sandboxHosting.listHosted()).rejects.toThrow(SandboxHostingError);
      await expect(sandboxHosting.listHosted()).rejects.toThrow(
        "Failed to list hosted sandboxes"
      );
    });
  });

  describe("getHostInfo", () => {
    it("should get hosting info for a specific sandbox", async () => {
      const mockSandbox: Sandbox = {
        id: "test-sandbox",
        status: "running",
        ports: { frontend: 3010, backend: 3011 },
        url: "http://localhost:3010",
      };

      vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

      const result = await sandboxHosting.getHostInfo("test-sandbox");

      expect(result).toEqual({
        sandboxId: "test-sandbox",
        url: "http://localhost:3000/api/sandbox/test-sandbox/proxy",
        status: "running",
        container: {
          id: "crayon-sandbox-test-sandbox",
          ports: {
            frontend: 3010,
            backend: 3011,
          },
        },
      });

      expect(mockSandboxManager.getStatus).toHaveBeenCalledWith("test-sandbox");
    });

    it("should throw NOT_FOUND error if sandbox doesn't exist", async () => {
      vi.mocked(mockSandboxManager.getStatus).mockRejectedValue(
        new Error("Sandbox not found")
      );

      await expect(sandboxHosting.getHostInfo("nonexistent")).rejects.toThrow(
        SandboxHostingError
      );

      const error = await sandboxHosting
        .getHostInfo("nonexistent")
        .catch((e) => e as SandboxHostingError);
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("status mapping", () => {
    it("should map error status correctly", async () => {
      const mockSandbox: Sandbox = {
        id: "test-sandbox",
        status: "error",
        ports: { frontend: 3010, backend: 3011 },
      };

      vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

      const result = await sandboxHosting.getHostInfo("test-sandbox");

      expect(result.status).toBe("error");
    });

    it("should map stopped status correctly", async () => {
      const mockSandbox: Sandbox = {
        id: "test-sandbox",
        status: "stopped",
        ports: { frontend: 3010, backend: 3011 },
      };

      vi.mocked(mockSandboxManager.getStatus).mockResolvedValue(mockSandbox);

      const result = await sandboxHosting.getHostInfo("test-sandbox");

      expect(result.status).toBe("stopped");
    });
  });

  describe("port allocation", () => {
    it("should include both frontend and backend ports", async () => {
      const mockSandbox: Sandbox = {
        id: "test-sandbox",
        status: "running",
        ports: { frontend: 3010, backend: 3011 },
      };

      vi.mocked(mockSandboxManager.start).mockResolvedValue(mockSandbox);

      const result = await sandboxHosting.startHosting("test-sandbox");

      expect(result.container.ports.frontend).toBe(3010);
      expect(result.container.ports.backend).toBe(3011);
    });
  });

  describe("container ID generation", () => {
    it("should generate correct container ID", async () => {
      const mockSandbox: Sandbox = {
        id: "my-app-123",
        status: "running",
        ports: { frontend: 3010, backend: 3011 },
      };

      vi.mocked(mockSandboxManager.start).mockResolvedValue(mockSandbox);

      const result = await sandboxHosting.startHosting("my-app-123");

      expect(result.container.id).toBe("crayon-sandbox-my-app-123");
    });
  });
});
