import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { validateApiKey, generateApiKey, getOrCreateApiKey } from "./api-keys.js";
import { resolveSandbox } from "./sandbox-resolver.js";
import type { SandboxManager } from "@crayon/core";

describe("MCP Server App", () => {
  let testDataDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDataDir = path.join(tmpdir(), `crayon-test-${Date.now()}`);
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testDataDir, { recursive: true, force: true });
  });

  describe("Sandbox Resolver", () => {
    const mockManager: SandboxManager = {
      getStatus: async (sandboxId: string) => {
        if (sandboxId === "test-project") {
          return {
            id: "test-project",
            status: "running",
            ports: { frontend: 8080, backend: 0 },
          };
        }
        throw new Error("Not found");
      },
    } as unknown as SandboxManager;

    test("returns null for invalid sandboxId format", async () => {
      const result = await resolveSandbox("../etc/passwd", testDataDir, mockManager);
      expect(result).toBeNull();
    });

    test("returns null for sandboxId with special characters", async () => {
      const result = await resolveSandbox("test/project", testDataDir, mockManager);
      expect(result).toBeNull();
    });

    test("returns null for non-existent sandbox", async () => {
      const result = await resolveSandbox("nonexistent", testDataDir, mockManager);
      expect(result).toBeNull();
    });

    test("returns sandbox info for existing sandbox", async () => {
      // Create test sandbox directory
      const sandboxPath = path.join(testDataDir, "projects", "test-project", "sandbox");
      await fs.mkdir(sandboxPath, { recursive: true });

      const result = await resolveSandbox("test-project", testDataDir, mockManager);
      expect(result).not.toBeNull();
      expect(result?.sandboxPath).toContain("test-project/sandbox");
      expect(result?.status).toBe("running");
    });

    test("returns stopped status for sandbox without running container", async () => {
      // Create test sandbox directory
      const sandboxPath = path.join(testDataDir, "projects", "stopped-project", "sandbox");
      await fs.mkdir(sandboxPath, { recursive: true });

      const result = await resolveSandbox("stopped-project", testDataDir, mockManager);
      expect(result).not.toBeNull();
      expect(result?.status).toBe("stopped");
      expect(result?.containerId).toBeUndefined();
    });
  });

  describe("API Keys", () => {
    test("rejects invalid key format", async () => {
      const valid = await validateApiKey("invalid", testDataDir);
      expect(valid).toBe(false);
    });

    test("rejects key with wrong prefix", async () => {
      const valid = await validateApiKey("xxx_abcdefghijklmnopqrstuvwxyz", testDataDir);
      expect(valid).toBe(false);
    });

    test("rejects key that is too short", async () => {
      const valid = await validateApiKey("cry_short", testDataDir);
      expect(valid).toBe(false);
    });

    test("rejects unknown key", async () => {
      const valid = await validateApiKey("cry_unknownkey12345678901234", testDataDir);
      expect(valid).toBe(false);
    });

    test("generates valid key format", async () => {
      const key = await generateApiKey("test-sandbox", testDataDir);
      expect(key).toMatch(/^cry_[a-zA-Z0-9_-]{20,}$/);
    });

    test("validates generated key", async () => {
      const key = await generateApiKey("test-sandbox", testDataDir);
      const valid = await validateApiKey(key, testDataDir);
      expect(valid).toBe(true);
    });

    test("stores key in keystore", async () => {
      const key = await generateApiKey("test-sandbox", testDataDir);

      // Read keystore
      const keystorePath = path.join(testDataDir, "mcp-api-keys.json");
      const content = await fs.readFile(keystorePath, "utf-8");
      const keystore = JSON.parse(content);

      expect(keystore.keys[key]).toBeDefined();
      expect(keystore.keys[key].sandboxId).toBe("test-sandbox");
      expect(keystore.keys[key].createdAt).toBeDefined();
    });

    test("updates lastUsed timestamp on validation", async () => {
      const key = await generateApiKey("test-sandbox", testDataDir);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Validate key
      await validateApiKey(key, testDataDir);

      // Read keystore
      const keystorePath = path.join(testDataDir, "mcp-api-keys.json");
      const content = await fs.readFile(keystorePath, "utf-8");
      const keystore = JSON.parse(content);

      expect(keystore.keys[key].lastUsed).toBeDefined();
    });

    test("getOrCreateApiKey creates new key if none exists", async () => {
      const key = await getOrCreateApiKey("new-sandbox", testDataDir);
      expect(key).toMatch(/^cry_[a-zA-Z0-9_-]{20,}$/);

      // Verify key is saved to project directory
      const keyFilePath = path.join(testDataDir, "projects", "new-sandbox", ".mcp-key");
      const savedKey = await fs.readFile(keyFilePath, "utf-8");
      expect(savedKey).toBe(key);
    });

    test("getOrCreateApiKey returns existing key", async () => {
      const key1 = await getOrCreateApiKey("existing-sandbox", testDataDir);
      const key2 = await getOrCreateApiKey("existing-sandbox", testDataDir);

      expect(key1).toBe(key2);
    });
  });
});
