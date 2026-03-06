/**
 * Docker Builder Integration Tests
 *
 * REQUIRES DOCKER DAEMON RUNNING
 *
 * These tests build real Docker images and run containers.
 * They are skipped if Docker is not available.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  build,
  generateDockerfile,
  generateCompose,
  startContainer,
  stopContainer,
  removeContainer,
  isDockerAvailable,
  getContainerStatus,
} from "./docker-builder.js";
import type { DockerConfig } from "./docker-builder.js";

const TEST_SANDBOX_ID = `test-${Date.now()}`;
let testDir: string;
let dockerAvailable: boolean;

async function createTestProject(baseDir: string): Promise<void> {
  // Create frontend directory with minimal React app
  const frontendDir = path.join(baseDir, "frontend");
  await fs.mkdir(frontendDir, { recursive: true });

  // Frontend package.json
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

  // Simple frontend server
  await fs.writeFile(
    path.join(frontendDir, "server.js"),
    `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<html><body><h1>Frontend Test</h1></body></html>');
});
server.listen(3000, () => console.log('Frontend running on port 3000'));
`
  );

  // Create backend directory
  const backendDir = path.join(baseDir, "backend");
  await fs.mkdir(backendDir, { recursive: true });

  // Backend package.json
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

  // Simple backend server
  await fs.writeFile(
    path.join(backendDir, "server.js"),
    `
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'backend' }));
});
server.listen(3001, () => console.log('Backend running on port 3001'));
`
  );

  // Create assets directory
  const assetsDir = path.join(baseDir, "assets");
  await fs.mkdir(assetsDir, { recursive: true });

  // Add a test asset
  await fs.writeFile(path.join(assetsDir, "test.txt"), "test asset content");
}

async function cleanup(): Promise<void> {
  if (!dockerAvailable) return;

  try {
    await removeContainer(TEST_SANDBOX_ID);
  } catch {
    // Ignore cleanup errors
  }

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
    console.log("Docker not available - skipping integration tests");
    return;
  }

  testDir = await fs.mkdtemp(path.join(os.tmpdir(), "docker-builder-test-"));
  await createTestProject(testDir);
});

afterAll(async () => {
  await cleanup();
});

describe.skipIf(!dockerAvailable)("Docker Builder Integration", () => {
  describe("isDockerAvailable", () => {
    it("returns true when Docker daemon is running", async () => {
      const available = await isDockerAvailable();
      expect(available).toBe(true);
    });
  });

  describe("build", () => {
    it("builds a Docker image from the sandbox", async () => {
      const config: DockerConfig = {
        sandboxId: TEST_SANDBOX_ID,
        frontendDir: path.join(testDir, "frontend"),
        backendDir: path.join(testDir, "backend"),
        assetsDir: path.join(testDir, "assets"),
      };

      const imageId = await build(config);

      expect(imageId).toBeDefined();
      expect(typeof imageId).toBe("string");
      expect(imageId.length).toBeGreaterThan(0);
    }, 120000); // 2 minute timeout for build

    it("throws on invalid config", async () => {
      const invalidConfig = {
        sandboxId: "",
        frontendDir: "/nonexistent",
        backendDir: "/nonexistent",
        assetsDir: "/nonexistent",
      };

      await expect(build(invalidConfig)).rejects.toThrow();
    });
  });

  describe("container lifecycle", () => {
    it("starts container from built image", async () => {
      // Use different ports to avoid conflicts
      const frontendPort = 13000;
      const backendPort = 13001;

      const containerInfo = await startContainer(
        TEST_SANDBOX_ID,
        frontendPort,
        backendPort
      );

      expect(containerInfo.containerId).toBeDefined();
      expect(containerInfo.containerName).toBe(`crayon-sandbox-${TEST_SANDBOX_ID}`);
      expect(containerInfo.ports.frontend).toBe(frontendPort);
      expect(containerInfo.ports.backend).toBe(backendPort);

      // Wait for services to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check container status
      const status = await getContainerStatus(TEST_SANDBOX_ID);
      expect(status).toBe("running");
    }, 30000);

    it("frontend responds at configured port", async () => {
      // Wait a bit more for the server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await fetch("http://localhost:13000");
      expect(response.ok).toBe(true);

      const text = await response.text();
      expect(text).toContain("Frontend Test");
    }, 10000);

    it("backend responds at configured port", async () => {
      const response = await fetch("http://localhost:13001");
      expect(response.ok).toBe(true);

      const json = await response.json();
      expect(json.status).toBe("ok");
      expect(json.service).toBe("backend");
    }, 10000);

    it("stops container", async () => {
      await stopContainer(TEST_SANDBOX_ID);

      const status = await getContainerStatus(TEST_SANDBOX_ID);
      expect(status).toBe("stopped");
    }, 30000);

    it("removes container", async () => {
      await removeContainer(TEST_SANDBOX_ID);

      const status = await getContainerStatus(TEST_SANDBOX_ID);
      expect(status).toBe("not_found");
    }, 10000);
  });

  describe("getContainerStatus", () => {
    it("returns not_found for non-existent container", async () => {
      const status = await getContainerStatus("nonexistent-container-id");
      expect(status).toBe("not_found");
    });
  });
});

describe("Docker output generation (no Docker required)", () => {
  it("generateDockerfile produces valid output", () => {
    const config: DockerConfig = {
      sandboxId: "test",
      frontendDir: "/frontend",
      backendDir: "/backend",
      assetsDir: "/assets",
    };

    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("FROM node:20-alpine");
    expect(dockerfile).toContain("EXPOSE 3000 3001");
  });

  it("generateCompose produces valid output", () => {
    const config: DockerConfig = {
      sandboxId: "test",
      frontendDir: "/frontend",
      backendDir: "/backend",
      assetsDir: "/assets",
    };

    const compose = generateCompose(config);

    expect(compose).toContain("version:");
    expect(compose).toContain("services:");
    expect(compose).toContain("sandbox:");
  });
});
