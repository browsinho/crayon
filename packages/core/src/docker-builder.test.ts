import { describe, expect, it } from "vitest";
import {
  generateDockerfile,
  generateCompose,
  DockerConfigSchema,
} from "./docker-builder.js";
import type { DockerConfig } from "./docker-builder.js";

function createConfig(overrides: Partial<DockerConfig> = {}): DockerConfig {
  return {
    sandboxId: "test-sandbox-123",
    frontendDir: "/tmp/frontend",
    backendDir: "/tmp/backend",
    assetsDir: "/tmp/assets",
    ...overrides,
  };
}

describe("generateDockerfile", () => {
  it("generates valid Dockerfile with correct base image", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("FROM node:20-alpine");
  });

  it("sets workdir to /app", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("WORKDIR /app");
  });

  it("copies frontend, backend, and assets directories", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("COPY frontend/ ./frontend/");
    expect(dockerfile).toContain("COPY backend/ ./backend/");
    expect(dockerfile).toContain("COPY assets/ ./assets/");
  });

  it("installs and builds frontend", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("cd frontend && npm install && npm run build");
  });

  it("installs backend dependencies", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("cd backend && npm install");
  });

  it("exposes ports 3000 and 3001", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("EXPOSE 3000 3001");
  });

  it("creates a start script that runs both services", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain("/app/start.sh");
    expect(dockerfile).toContain("cd /app/backend && npm start");
    expect(dockerfile).toContain("cd /app/frontend && npm start");
  });

  it("uses CMD to run the start script", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);

    expect(dockerfile).toContain('CMD ["/bin/sh", "/app/start.sh"]');
  });
});

describe("generateCompose", () => {
  it("generates valid docker-compose version", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    expect(compose).toContain("version: '3.8'");
  });

  it("uses sandboxId in image and container name", () => {
    const config = createConfig({ sandboxId: "my-sandbox" });
    const compose = generateCompose(config);

    expect(compose).toContain("image: crayon-sandbox-my-sandbox");
    expect(compose).toContain("container_name: crayon-sandbox-my-sandbox");
  });

  it("maps port 3000 for frontend", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    expect(compose).toContain('"3000:3000"');
  });

  it("maps port 3001 for backend", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    expect(compose).toContain('"3001:3001"');
  });

  it("sets NODE_ENV to production", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    expect(compose).toContain("NODE_ENV=production");
  });

  it("sets restart policy to unless-stopped", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    expect(compose).toContain("restart: unless-stopped");
  });

  it("defines sandbox service", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    expect(compose).toContain("services:");
    expect(compose).toContain("sandbox:");
  });
});

describe("DockerConfigSchema", () => {
  it("validates valid config", () => {
    const config = createConfig();
    const result = DockerConfigSchema.safeParse(config);

    expect(result.success).toBe(true);
  });

  it("rejects empty sandboxId", () => {
    const config = createConfig({ sandboxId: "" });
    const result = DockerConfigSchema.safeParse(config);

    expect(result.success).toBe(false);
  });

  it("rejects empty frontendDir", () => {
    const config = createConfig({ frontendDir: "" });
    const result = DockerConfigSchema.safeParse(config);

    expect(result.success).toBe(false);
  });

  it("rejects empty backendDir", () => {
    const config = createConfig({ backendDir: "" });
    const result = DockerConfigSchema.safeParse(config);

    expect(result.success).toBe(false);
  });

  it("rejects empty assetsDir", () => {
    const config = createConfig({ assetsDir: "" });
    const result = DockerConfigSchema.safeParse(config);

    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = DockerConfigSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("accepts valid sandboxId formats", () => {
    const configs = [
      createConfig({ sandboxId: "abc-123" }),
      createConfig({ sandboxId: "test_sandbox" }),
      createConfig({ sandboxId: "sandbox123" }),
    ];

    for (const config of configs) {
      const result = DockerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    }
  });
});

describe("Dockerfile template structure", () => {
  it("follows correct order of operations", () => {
    const config = createConfig();
    const dockerfile = generateDockerfile(config);
    const lines = dockerfile.split("\n");

    const fromIndex = lines.findIndex(l => l.startsWith("FROM"));
    const workdirIndex = lines.findIndex(l => l.startsWith("WORKDIR"));
    const copyIndex = lines.findIndex(l => l.includes("COPY"));
    const exposeIndex = lines.findIndex(l => l.startsWith("EXPOSE"));
    const cmdIndex = lines.findIndex(l => l.startsWith("CMD"));

    expect(fromIndex).toBeLessThan(workdirIndex);
    expect(workdirIndex).toBeLessThan(copyIndex);
    expect(copyIndex).toBeLessThan(exposeIndex);
    expect(exposeIndex).toBeLessThan(cmdIndex);
  });
});

describe("docker-compose.yml structure", () => {
  it("has proper YAML structure", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    // Check indentation and structure
    expect(compose).toMatch(/^version:/m);
    expect(compose).toMatch(/^services:/m);
    expect(compose).toMatch(/^\s{2}sandbox:/m);
    expect(compose).toMatch(/^\s{4}image:/m);
    expect(compose).toMatch(/^\s{4}ports:/m);
  });

  it("includes all required service configuration", () => {
    const config = createConfig();
    const compose = generateCompose(config);

    expect(compose).toContain("image:");
    expect(compose).toContain("container_name:");
    expect(compose).toContain("ports:");
    expect(compose).toContain("environment:");
    expect(compose).toContain("restart:");
  });
});
