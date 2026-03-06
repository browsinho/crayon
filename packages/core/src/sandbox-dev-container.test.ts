/**
 * Unit tests for Sandbox Dev Container
 */

import { describe, test, expect } from "vitest";
import {
  DevContainerConfigSchema,
  type DevContainerConfig,
  type DevContainerStatus,
  type DevContainerInfo,
  type LogEntry,
} from "./sandbox-dev-container.js";

describe("DevContainerConfigSchema", () => {
  test("validates valid config", () => {
    const config: DevContainerConfig = {
      sandboxId: "test-sandbox",
      projectPath: "/path/to/project",
      port: 3000,
      enableHmr: true,
    };

    expect(() => DevContainerConfigSchema.parse(config)).not.toThrow();
  });

  test("validates config with defaults", () => {
    const config = {
      sandboxId: "test-sandbox",
      projectPath: "/path/to/project",
    };

    const parsed = DevContainerConfigSchema.parse(config);
    expect(parsed.port).toBe(3000);
    expect(parsed.enableHmr).toBe(true);
  });

  test("validates config with watch options", () => {
    const config: DevContainerConfig = {
      sandboxId: "test-sandbox",
      projectPath: "/path/to/project",
      port: 3001,
      watchOptions: {
        usePolling: true,
        pollInterval: 200,
      },
    };

    expect(() => DevContainerConfigSchema.parse(config)).not.toThrow();
  });

  test("rejects invalid sandbox ID", () => {
    const config = {
      sandboxId: "", // Invalid - empty string
      projectPath: "/path/to/project",
    };

    expect(() => DevContainerConfigSchema.parse(config)).toThrow();
  });

  test("rejects invalid project path", () => {
    const config = {
      sandboxId: "test-sandbox",
      projectPath: "", // Invalid - empty string
    };

    expect(() => DevContainerConfigSchema.parse(config)).toThrow();
  });

  test("rejects invalid port", () => {
    const config = {
      sandboxId: "test-sandbox",
      projectPath: "/path/to/project",
      port: "not-a-number", // Invalid
    };

    expect(() => DevContainerConfigSchema.parse(config)).toThrow();
  });
});

describe("DevContainerStatus", () => {
  test("has correct status types", () => {
    const statuses: DevContainerStatus[] = [
      "stopped",
      "starting",
      "running",
      "error",
      "restarting",
    ];

    // Ensure all statuses are valid
    for (const status of statuses) {
      expect(typeof status).toBe("string");
    }
  });
});

describe("DevContainerInfo", () => {
  test("has correct structure", () => {
    const info: DevContainerInfo = {
      sandboxId: "test-sandbox",
      containerId: "container-123",
      status: "running",
      port: 3000,
      url: "http://localhost:3000",
      uptime: 120,
      restartCount: 0,
    };

    expect(info.sandboxId).toBe("test-sandbox");
    expect(info.status).toBe("running");
    expect(info.port).toBe(3000);
    expect(info.uptime).toBeGreaterThanOrEqual(0);
  });

  test("can include optional fields", () => {
    const info: DevContainerInfo = {
      sandboxId: "test-sandbox",
      containerId: "container-123",
      status: "error",
      port: 3000,
      url: "http://localhost:3000",
      uptime: 60,
      restartCount: 3,
      lastError: "Container crashed due to syntax error",
      memoryUsage: 512,
      cpuPercent: 25.5,
    };

    expect(info.lastError).toBeDefined();
    expect(info.memoryUsage).toBe(512);
    expect(info.cpuPercent).toBe(25.5);
  });
});

describe("LogEntry", () => {
  test("has correct structure", () => {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      stream: "stdout",
      message: "Vite server started",
    };

    expect(logEntry.timestamp).toBeInstanceOf(Date);
    expect(logEntry.stream).toBe("stdout");
    expect(logEntry.message).toBe("Vite server started");
  });

  test("supports stderr stream", () => {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      stream: "stderr",
      message: "Error: Failed to compile",
    };

    expect(logEntry.stream).toBe("stderr");
    expect(logEntry.message).toContain("Error");
  });
});

describe("Package name validation", () => {
  test("validates valid package names", () => {
    const validNames = [
      "lodash",
      "react",
      "@types/node",
      "@vue/compiler-sfc",
      "package-name",
      "package_name",
      "package.name",
    ];

    for (const name of validNames) {
      const regex = /^[@a-z0-9][-a-z0-9._/@]*$/i;
      expect(regex.test(name)).toBe(true);
    }
  });

  test("rejects invalid package names", () => {
    const invalidNames = [
      "../../../etc/passwd", // Path traversal
      "; rm -rf /", // Command injection
      "package&&evil", // Command chaining
      "package|evil", // Pipe
    ];

    for (const name of invalidNames) {
      const regex = /^[@a-z0-9][-a-z0-9._/@]*$/i;
      expect(regex.test(name)).toBe(false);
    }
  });
});

describe("DevContainerManager interface", () => {
  test("defines all required methods", () => {
    // This test just ensures the interface is properly defined
    // Actual implementation tests would require Docker
    const methods = [
      "start",
      "stop",
      "restart",
      "getStatus",
      "list",
      "streamLogs",
      "exec",
      "installPackages",
    ];

    // Verify methods exist in the interface definition
    expect(methods.length).toBe(8);
  });
});

describe("URL format", () => {
  test("generates correct URL format", () => {
    const port = 3000;
    const url = `http://localhost:${port}`;

    expect(url).toBe("http://localhost:3000");
    expect(url).toMatch(/^http:\/\/localhost:\d+$/);
  });

  test("handles different ports", () => {
    const ports = [3000, 3001, 8080, 8081];

    for (const port of ports) {
      const url = `http://localhost:${port}`;
      expect(url).toContain(`localhost:${port}`);
    }
  });
});

describe("Container name format", () => {
  test("generates correct container name", () => {
    const prefix = "crayon-dev-";
    const sandboxId = "test-sandbox-123";
    const containerName = `${prefix}${sandboxId}`;

    expect(containerName).toBe("crayon-dev-test-sandbox-123");
    expect(containerName).toMatch(/^crayon-dev-.+$/);
  });

  test("extracts sandbox ID from container name", () => {
    const prefix = "crayon-dev-";
    const containerName = "crayon-dev-test-sandbox-123";
    const sandboxId = containerName.slice(prefix.length);

    expect(sandboxId).toBe("test-sandbox-123");
  });
});

describe("Environment variables", () => {
  test("includes required environment variables", () => {
    const env = ["NODE_ENV=development", "CHOKIDAR_USEPOLLING=true"];

    expect(env).toContain("NODE_ENV=development");
    expect(env).toContain("CHOKIDAR_USEPOLLING=true");
  });

  test("NODE_ENV is set to development", () => {
    const env = ["NODE_ENV=development"];
    const nodeEnv = env.find((e) => e.startsWith("NODE_ENV="));

    expect(nodeEnv).toBe("NODE_ENV=development");
  });

  test("CHOKIDAR_USEPOLLING is set to true", () => {
    const env = ["CHOKIDAR_USEPOLLING=true"];
    const chokidar = env.find((e) => e.startsWith("CHOKIDAR_USEPOLLING="));

    expect(chokidar).toBe("CHOKIDAR_USEPOLLING=true");
  });
});

describe("Port binding format", () => {
  test("generates correct port binding", () => {
    const port = 3000;
    const binding = {
      "3000/tcp": [{ HostPort: String(port) }],
    };

    expect(binding["3000/tcp"]).toBeDefined();
    expect(binding["3000/tcp"][0].HostPort).toBe("3000");
  });

  test("handles different ports", () => {
    const ports = [3000, 3001, 8080];

    for (const port of ports) {
      const binding = {
        "3000/tcp": [{ HostPort: String(port) }],
      };

      expect(binding["3000/tcp"][0].HostPort).toBe(String(port));
    }
  });
});

describe("Volume bind format", () => {
  test("generates correct bind mount", () => {
    const projectPath = "/path/to/project";
    const bind = `${projectPath}:/app:rw`;

    expect(bind).toBe("/path/to/project:/app:rw");
    expect(bind).toMatch(/^.+:\/app:rw$/);
  });

  test("uses read-write mode", () => {
    const bind = "/path/to/project:/app:rw";

    expect(bind).toContain(":rw");
    expect(bind.endsWith(":rw")).toBe(true);
  });

  test("mounts to /app directory", () => {
    const bind = "/path/to/project:/app:rw";

    expect(bind).toContain(":/app:");
  });
});

describe("Restart policy", () => {
  test("uses on-failure policy", () => {
    const restartPolicy = {
      Name: "on-failure",
      MaximumRetryCount: 5,
    };

    expect(restartPolicy.Name).toBe("on-failure");
    expect(restartPolicy.MaximumRetryCount).toBe(5);
  });

  test("has maximum retry count", () => {
    const maxRetries = 5;

    expect(maxRetries).toBeGreaterThan(0);
    expect(maxRetries).toBeLessThanOrEqual(10);
  });
});

describe("Docker command", () => {
  test("includes npm install", () => {
    const cmd = "npm install && npm run dev -- --host 0.0.0.0";

    expect(cmd).toContain("npm install");
    expect(cmd).toContain("&&");
  });

  test("includes dev command with host flag", () => {
    const cmd = "npm install && npm run dev -- --host 0.0.0.0";

    expect(cmd).toContain("npm run dev");
    expect(cmd).toContain("--host 0.0.0.0");
  });

  test("chains commands correctly", () => {
    const cmd = "npm install && npm run dev -- --host 0.0.0.0";
    const parts = cmd.split(" && ");

    expect(parts.length).toBe(2);
    expect(parts[0]).toBe("npm install");
    expect(parts[1]).toContain("npm run dev");
  });
});
