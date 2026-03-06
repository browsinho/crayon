/**
 * Sandbox Manager Integration Tests
 *
 * REQUIRES DOCKER DAEMON RUNNING + BUILT IMAGE
 *
 * These tests manage real Docker containers.
 * They are skipped if Docker is not available.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { SandboxManager, SandboxManagerError, createSandboxManager } from "./sandbox-manager.js";
import { build, isDockerAvailable, removeContainer } from "./docker-builder.js";
import type { DockerConfig } from "./docker-builder.js";

const TEST_SANDBOX_ID_1 = `sandbox-mgr-test-1-${Date.now()}`;
const TEST_SANDBOX_ID_2 = `sandbox-mgr-test-2-${Date.now()}`;
let testDir: string;
let dockerAvailable: boolean;
let manager: SandboxManager;

async function createTestProject(baseDir: string): Promise<void> {
  // Create frontend directory with minimal server
  const frontendDir = path.join(baseDir, "frontend");
  await fs.mkdir(frontendDir, { recursive: true });

  await fs.writeFile(
    path.join(frontendDir, "package.json"),
    JSON.stringify(
      {
        name: "test-frontend",
        version: "1.0.0",
        scripts: {
          build: "echo 'build complete'",
          start: "node server.js",
        },
        dependencies: {},
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(frontendDir, "server.js"),
    `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<html><body><h1>Sandbox Manager Test Frontend</h1></body></html>');
});
server.listen(3000, () => console.log('Frontend running on port 3000'));
`
  );

  // Create backend directory
  const backendDir = path.join(baseDir, "backend");
  await fs.mkdir(backendDir, { recursive: true });

  await fs.writeFile(
    path.join(backendDir, "package.json"),
    JSON.stringify(
      {
        name: "test-backend",
        version: "1.0.0",
        scripts: {
          start: "node server.js",
        },
        dependencies: {},
      },
      null,
      2
    )
  );

  await fs.writeFile(
    path.join(backendDir, "server.js"),
    `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', test: 'sandbox-manager' }));
});
server.listen(3001, () => console.log('Backend running on port 3001'));
`
  );

  // Create assets directory
  const assetsDir = path.join(baseDir, "assets");
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, "test.txt"), "test asset");
}

async function buildTestImage(sandboxId: string, baseDir: string): Promise<void> {
  const config: DockerConfig = {
    sandboxId,
    frontendDir: path.join(baseDir, "frontend"),
    backendDir: path.join(baseDir, "backend"),
    assetsDir: path.join(baseDir, "assets"),
  };
  await build(config);
}

async function cleanup(): Promise<void> {
  if (!dockerAvailable) return;

  // Remove test containers
  for (const sandboxId of [TEST_SANDBOX_ID_1, TEST_SANDBOX_ID_2]) {
    try {
      await removeContainer(sandboxId);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Remove temp directory
  if (testDir) {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

beforeAll(async () => {
  dockerAvailable = await isDockerAvailable();

  if (!dockerAvailable) {
    console.log("Docker not available - skipping sandbox-manager integration tests");
    return;
  }

  manager = createSandboxManager();

  // Create test project and build images
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-mgr-test-"));
  await createTestProject(testDir);

  // Build test images for both sandboxes
  await buildTestImage(TEST_SANDBOX_ID_1, testDir);
  await buildTestImage(TEST_SANDBOX_ID_2, testDir);
}, 180000); // 3 minutes for builds

afterAll(async () => {
  await cleanup();
}, 60000);

describe.skipIf(!dockerAvailable)("Sandbox Manager Integration", () => {
  describe("start", () => {
    it("starts a sandbox container and returns correct status", async () => {
      const sandbox = await manager.start(TEST_SANDBOX_ID_1);

      expect(sandbox.id).toBe(TEST_SANDBOX_ID_1);
      expect(sandbox.status).toBe("running");
      expect(sandbox.ports.frontend).toBeGreaterThanOrEqual(3000);
      expect(sandbox.ports.backend).toBeGreaterThanOrEqual(3001);
      expect(sandbox.url).toMatch(/^http:\/\/localhost:\d+$/);
    }, 30000);

    it("returns running sandbox if already started", async () => {
      // Start again - should return existing running sandbox
      const sandbox = await manager.start(TEST_SANDBOX_ID_1);

      expect(sandbox.id).toBe(TEST_SANDBOX_ID_1);
      expect(sandbox.status).toBe("running");
    }, 10000);
  });

  describe("getStatus", () => {
    it("returns correct status for running sandbox", async () => {
      const sandbox = await manager.getStatus(TEST_SANDBOX_ID_1);

      expect(sandbox.id).toBe(TEST_SANDBOX_ID_1);
      expect(sandbox.status).toBe("running");
      expect(sandbox.url).toBeDefined();
    });

    it("throws NOT_FOUND for non-existent sandbox", async () => {
      await expect(manager.getStatus("nonexistent-sandbox-xyz")).rejects.toThrow(
        SandboxManagerError
      );
      await expect(manager.getStatus("nonexistent-sandbox-xyz")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("list", () => {
    it("includes the running sandbox", async () => {
      const sandboxes = await manager.list();

      const testSandbox = sandboxes.find(s => s.id === TEST_SANDBOX_ID_1);
      expect(testSandbox).toBeDefined();
      expect(testSandbox?.status).toBe("running");
    });
  });

  describe("multiple sandboxes", () => {
    it("starts second sandbox with different ports", async () => {
      const sandbox1 = await manager.getStatus(TEST_SANDBOX_ID_1);
      const sandbox2 = await manager.start(TEST_SANDBOX_ID_2);

      expect(sandbox2.id).toBe(TEST_SANDBOX_ID_2);
      expect(sandbox2.status).toBe("running");

      // Ports should be different
      expect(sandbox2.ports.frontend).not.toBe(sandbox1.ports.frontend);
      expect(sandbox2.ports.backend).not.toBe(sandbox1.ports.backend);
    }, 30000);

    it("lists both sandboxes", async () => {
      const sandboxes = await manager.list();

      const sandbox1 = sandboxes.find(s => s.id === TEST_SANDBOX_ID_1);
      const sandbox2 = sandboxes.find(s => s.id === TEST_SANDBOX_ID_2);

      expect(sandbox1).toBeDefined();
      expect(sandbox2).toBeDefined();
      expect(sandbox1?.status).toBe("running");
      expect(sandbox2?.status).toBe("running");
    });
  });

  describe("URL accessibility", () => {
    it("frontend responds at allocated port", async () => {
      const sandbox = await manager.getStatus(TEST_SANDBOX_ID_1);

      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(`http://localhost:${sandbox.ports.frontend}`);
      expect(response.ok).toBe(true);

      const text = await response.text();
      expect(text).toContain("Sandbox Manager Test Frontend");
    }, 15000);

    it("backend responds at allocated port", async () => {
      const sandbox = await manager.getStatus(TEST_SANDBOX_ID_1);

      const response = await fetch(`http://localhost:${sandbox.ports.backend}`);
      expect(response.ok).toBe(true);

      const json = await response.json();
      expect(json.status).toBe("ok");
      expect(json.test).toBe("sandbox-manager");
    }, 10000);
  });

  describe("stop", () => {
    it("stops running sandbox", async () => {
      await manager.stop(TEST_SANDBOX_ID_2);

      const sandbox = await manager.getStatus(TEST_SANDBOX_ID_2);
      expect(sandbox.status).toBe("stopped");
      expect(sandbox.url).toBeUndefined();
    }, 30000);

    it("does not throw when stopping already stopped sandbox", async () => {
      // Should not throw
      await expect(manager.stop(TEST_SANDBOX_ID_2)).resolves.toBeUndefined();
    });

    it("throws NOT_FOUND when stopping non-existent sandbox", async () => {
      await expect(manager.stop("nonexistent-xyz")).rejects.toThrow(SandboxManagerError);
      await expect(manager.stop("nonexistent-xyz")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("restart cycle", () => {
    it("can restart a stopped sandbox", async () => {
      // sandbox2 is stopped from previous test
      const sandbox = await manager.start(TEST_SANDBOX_ID_2);

      expect(sandbox.status).toBe("running");
      expect(sandbox.url).toBeDefined();

      // Clean up
      await manager.stop(TEST_SANDBOX_ID_2);
    }, 30000);
  });

  describe("cleanup", () => {
    it("stops first sandbox", async () => {
      await manager.stop(TEST_SANDBOX_ID_1);

      const sandbox = await manager.getStatus(TEST_SANDBOX_ID_1);
      expect(sandbox.status).toBe("stopped");
    }, 30000);
  });
});

describe("Sandbox Manager (no Docker required)", () => {
  it("creates manager instance without Docker", () => {
    const manager = createSandboxManager();
    expect(manager).toBeInstanceOf(SandboxManager);
  });
});
