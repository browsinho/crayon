# Sandbox Dev Container

Development mode for sandboxes with volume-mounted code for hot reloading.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "dockerode volume bind mount nodejs 2025"
- Search: "vite hot reload docker container volume"
- Search: "Docker container restart policy nodejs"

## Purpose

Enables live code editing in sandboxes by mounting the project directory as a volume. Changes to files are immediately reflected in the running container without rebuilding the image.

## Current vs. New Architecture

### Current Architecture (Production Mode)
1. Code is COPIED into Docker image at build time
2. Changing code requires rebuilding the entire image (~30-60 seconds)
3. Good for deployment, bad for development/editing

### New Architecture (Development Mode)
1. Code is MOUNTED as a volume from host filesystem
2. Vite dev server watches for file changes
3. Changes reflect in ~1-2 seconds via hot module replacement (HMR)
4. Perfect for the code agent workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     HOST FILESYSTEM                          │
│  ./data/projects/{id}/sandbox/                               │
│  ├── src/                                                    │
│  │   ├── App.tsx        ← Code agent edits this             │
│  │   └── components/                                         │
│  ├── package.json                                            │
│  └── vite.config.ts                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │ Volume Mount
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   DOCKER CONTAINER                           │
│  /app/ (mounted from host)                                   │
│  ├── node_modules/ (installed in container)                  │
│  └── src/ ... (from host)                                    │
│                                                              │
│  Process: vite --host 0.0.0.0 (watches /app/src)             │
│  Port: 3000 → exposed to host                                │
└─────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Can start a sandbox in development mode with volume mount
- [ ] Vite dev server runs with HMR enabled
- [ ] File changes on host reflect in container within 2 seconds
- [ ] Container survives syntax errors (doesn't crash permanently)
- [ ] Can switch between dev mode and production mode
- [ ] Dependencies (node_modules) persist between restarts
- [ ] Sandbox URL is accessible from browser
- [ ] Container logs are accessible for debugging

## Interface

```typescript
// packages/core/src/sandbox-dev-container.ts

import { z } from "zod";

// ==================== CONFIGURATION ====================

export const DevContainerConfigSchema = z.object({
  sandboxId: z.string().min(1),
  projectPath: z.string().min(1), // Absolute path to sandbox directory
  port: z.number().default(3000),
  
  // Development options
  enableHmr: z.boolean().default(true),
  watchOptions: z.object({
    usePolling: z.boolean().default(false), // Required for some Docker setups
    pollInterval: z.number().default(100),
  }).optional(),
});

export type DevContainerConfig = z.infer<typeof DevContainerConfigSchema>;

// ==================== STATUS ====================

export type DevContainerStatus =
  | "stopped"
  | "starting"
  | "running"
  | "error"
  | "restarting";

export interface DevContainerInfo {
  sandboxId: string;
  containerId: string;
  status: DevContainerStatus;
  port: number;
  url: string; // http://localhost:{port}
  
  // Health info
  uptime: number; // seconds
  restartCount: number;
  lastError?: string;
  
  // Resource usage
  memoryUsage?: number; // MB
  cpuPercent?: number;
}

// ==================== LOG STREAMING ====================

export interface LogEntry {
  timestamp: Date;
  stream: "stdout" | "stderr";
  message: string;
}

// ==================== MAIN INTERFACE ====================

export interface DevContainerManager {
  /**
   * Start a dev container with volume mount
   */
  start(config: DevContainerConfig): Promise<DevContainerInfo>;

  /**
   * Stop a running dev container
   */
  stop(sandboxId: string): Promise<void>;

  /**
   * Restart the dev container (useful after package.json changes)
   */
  restart(sandboxId: string): Promise<DevContainerInfo>;

  /**
   * Get current status of a dev container
   */
  getStatus(sandboxId: string): Promise<DevContainerInfo | null>;

  /**
   * List all running dev containers
   */
  list(): Promise<DevContainerInfo[]>;

  /**
   * Stream container logs
   */
  streamLogs(
    sandboxId: string,
    options?: { tail?: number; follow?: boolean }
  ): AsyncGenerator<LogEntry>;

  /**
   * Execute a command in the container
   */
  exec(
    sandboxId: string,
    command: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /**
   * Install npm packages in the container
   */
  installPackages(
    sandboxId: string,
    packages: string[]
  ): Promise<{ success: boolean; output: string }>;
}

/**
 * Create a dev container manager instance
 */
export function createDevContainerManager(): DevContainerManager;
```

## Implementation Details

### Base Development Image

Create a reusable base image for all dev containers:

```dockerfile
# Dockerfile.dev-base
FROM node:20-alpine

WORKDIR /app

# Install global tools
RUN npm install -g serve

# Create a startup script that handles dependency installation
COPY dev-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/dev-entrypoint.sh"]
```

**dev-entrypoint.sh:**

```bash
#!/bin/sh
set -e

# Check if node_modules exists
if [ ! -d "/app/node_modules" ]; then
  echo "[DevContainer] Installing dependencies..."
  npm install
fi

# Check if dependencies are up to date
if [ /app/package.json -nt /app/node_modules ]; then
  echo "[DevContainer] package.json changed, updating dependencies..."
  npm install
fi

echo "[DevContainer] Starting Vite dev server..."
exec npm run dev -- --host 0.0.0.0
```

### Build Base Image

```typescript
async function ensureBaseImageExists(): Promise<void> {
  const docker = new Docker();
  const imageName = "crayon-dev-base:latest";

  try {
    await docker.getImage(imageName).inspect();
    console.log("[DevContainer] Base image exists");
  } catch {
    console.log("[DevContainer] Building base image...");
    
    // Create Dockerfile content
    const dockerfile = `FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
EXPOSE 3000
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]`;

    // Build the image
    const tarStream = createTarWithDockerfile(dockerfile);
    const buildStream = await docker.buildImage(tarStream, { t: imageName });
    await waitForBuild(buildStream);
  }
}
```

### Start Dev Container

```typescript
async function start(config: DevContainerConfig): Promise<DevContainerInfo> {
  const docker = new Docker();
  const validated = DevContainerConfigSchema.parse(config);
  
  await ensureBaseImageExists();
  
  const containerName = `crayon-dev-${validated.sandboxId}`;
  
  // Check if container already exists
  try {
    const existing = docker.getContainer(containerName);
    const info = await existing.inspect();
    
    if (info.State.Running) {
      // Already running, return info
      return getContainerInfo(validated.sandboxId, existing);
    }
    
    // Exists but stopped, remove and recreate
    await existing.remove();
  } catch {
    // Container doesn't exist, continue
  }

  // Resolve absolute path
  const absolutePath = path.resolve(validated.projectPath);
  
  // Ensure package.json has dev script
  await ensureDevScript(absolutePath);

  // Create container with volume mount
  const container = await docker.createContainer({
    Image: "crayon-dev-base:latest",
    name: containerName,
    
    // Environment
    Env: [
      "NODE_ENV=development",
      "CHOKIDAR_USEPOLLING=true", // Required for Docker volume watching
    ],
    
    // Volume mount - THIS IS THE KEY
    HostConfig: {
      Binds: [
        `${absolutePath}:/app:rw`, // Mount project as read-write
      ],
      PortBindings: {
        "3000/tcp": [{ HostPort: String(validated.port) }],
      },
      // Restart on crash (syntax errors shouldn't kill the container permanently)
      RestartPolicy: {
        Name: "on-failure",
        MaximumRetryCount: 5,
      },
    },
    
    // Exposed ports
    ExposedPorts: {
      "3000/tcp": {},
    },
    
    // Working directory
    WorkingDir: "/app",
    
    // Start command
    Cmd: ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"],
  });

  // Start the container
  await container.start();

  // Wait for Vite to be ready
  await waitForViteReady(validated.port);

  return getContainerInfo(validated.sandboxId, container);
}
```

### Ensure Dev Script Exists

The project needs a `dev` script in package.json:

```typescript
async function ensureDevScript(projectPath: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");
  
  const content = await fs.readFile(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(content);
  
  // Check if dev script exists
  if (!packageJson.scripts?.dev) {
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts.dev = "vite";
    
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );
    
    console.log("[DevContainer] Added 'dev' script to package.json");
  }
}
```

### Wait for Vite Ready

```typescript
async function waitForViteReady(
  port: number,
  timeout: number = 30000
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok) {
        console.log("[DevContainer] Vite server is ready");
        return;
      }
    } catch {
      // Not ready yet
    }
    
    await sleep(500);
  }
  
  throw new Error(`Vite server did not start within ${timeout}ms`);
}
```

### Stream Container Logs

```typescript
async function* streamLogs(
  sandboxId: string,
  options?: { tail?: number; follow?: boolean }
): AsyncGenerator<LogEntry> {
  const docker = new Docker();
  const containerName = `crayon-dev-${sandboxId}`;
  const container = docker.getContainer(containerName);

  const stream = await container.logs({
    follow: options?.follow ?? true,
    stdout: true,
    stderr: true,
    tail: options?.tail ?? 100,
    timestamps: true,
  });

  // Parse log stream
  for await (const chunk of stream) {
    const lines = chunk.toString().split("\n").filter(Boolean);
    
    for (const line of lines) {
      // Docker log format: [stream_type][timestamp] message
      // First 8 bytes are header
      const header = chunk.slice(0, 8);
      const streamType = header[0] === 1 ? "stdout" : "stderr";
      
      // Extract timestamp if present
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
      const timestamp = timestampMatch
        ? new Date(timestampMatch[1])
        : new Date();
      
      const message = timestampMatch
        ? line.slice(timestampMatch[0].length).trim()
        : line;

      yield {
        timestamp,
        stream: streamType,
        message,
      };
    }
  }
}
```

### Execute Commands in Container

```typescript
async function exec(
  sandboxId: string,
  command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const docker = new Docker();
  const containerName = `crayon-dev-${sandboxId}`;
  const container = docker.getContainer(containerName);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    docker.modem.demuxStream(
      stream,
      { write: (chunk: Buffer) => { stdout += chunk.toString(); } },
      { write: (chunk: Buffer) => { stderr += chunk.toString(); } }
    );

    stream.on("end", async () => {
      const inspect = await exec.inspect();
      resolve({
        stdout,
        stderr,
        exitCode: inspect.ExitCode ?? 1,
      });
    });
  });
}
```

### Install Packages

```typescript
async function installPackages(
  sandboxId: string,
  packages: string[]
): Promise<{ success: boolean; output: string }> {
  // Validate package names (security)
  for (const pkg of packages) {
    if (!/^[@a-z0-9][-a-z0-9._/@]*$/i.test(pkg)) {
      throw new Error(`Invalid package name: ${pkg}`);
    }
  }

  const command = ["npm", "install", ...packages];
  const result = await exec(sandboxId, command);

  return {
    success: result.exitCode === 0,
    output: result.stdout + result.stderr,
  };
}
```

## Modify Existing Sandbox Manager

Update `packages/core/src/sandbox-manager.ts` to support dev mode:

```typescript
// Add to SandboxManager class

export type SandboxMode = "production" | "development";

interface StartOptions {
  mode?: SandboxMode;
}

async buildAndStart(
  sandboxId: string,
  projectDir: string,
  options: StartOptions = {}
): Promise<Sandbox> {
  const mode = options.mode ?? "development"; // Default to dev mode

  if (mode === "development") {
    // Use dev container manager
    const devManager = createDevContainerManager();
    const info = await devManager.start({
      sandboxId,
      projectPath: projectDir,
      port: await this.allocatePort(),
    });

    return {
      id: sandboxId,
      status: "running",
      ports: { frontend: info.port, backend: 0 },
      url: info.url,
      mode: "development",
    };
  }

  // Existing production mode logic
  return this.startProductionContainer(sandboxId, projectDir);
}
```

## Vite Configuration for Docker

Ensure the generated Vite config works well with Docker:

```typescript
// Generated vite.config.ts content
export function generateViteConfigForDocker(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Required for Docker
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true, // Required for Docker volume watching
      interval: 100,
    },
    hmr: {
      host: "localhost", // HMR connects back to host
    },
  },
  // Ensure consistent builds
  build: {
    sourcemap: true,
  },
});
`;
}
```

## Error Recovery

Handle common errors gracefully:

```typescript
async function handleContainerCrash(sandboxId: string): Promise<void> {
  const docker = new Docker();
  const containerName = `crayon-dev-${sandboxId}`;
  const container = docker.getContainer(containerName);

  const info = await container.inspect();

  // Check if crashed due to syntax error
  if (info.State.ExitCode !== 0) {
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 50,
    });

    const logText = logs.toString();

    // Check for common Vite/TS errors
    if (
      logText.includes("SyntaxError") ||
      logText.includes("Error: Build failed")
    ) {
      console.log(
        "[DevContainer] Container crashed due to code error, will restart when fixed"
      );

      // Don't restart immediately - wait for file change
      // The restart policy will handle automatic retry
      return;
    }
  }

  // Other errors - try to restart
  console.log("[DevContainer] Attempting to restart crashed container...");
  await container.restart();
}
```

## Integration with Code Agent

The code agent should use dev containers:

```typescript
// In code-agent.ts

async function initializeForSandbox(sandboxId: string): Promise<{
  containerInfo: DevContainerInfo;
  sandboxPath: string;
}> {
  const projectPath = `./data/projects/${sandboxId}/sandbox`;
  const devManager = createDevContainerManager();

  // Ensure dev container is running
  let containerInfo = await devManager.getStatus(sandboxId);

  if (!containerInfo || containerInfo.status !== "running") {
    containerInfo = await devManager.start({
      sandboxId,
      projectPath: path.resolve(projectPath),
    });
  }

  return {
    containerInfo,
    sandboxPath: path.resolve(projectPath),
  };
}
```

## Dependencies

Already in `packages/core/package.json`:
- `dockerode` - Docker API client

No additional dependencies needed.

## Testing Requirements

### Unit Tests (`sandbox-dev-container.test.ts`)

```typescript
describe("DevContainerManager", () => {
  describe("Configuration", () => {
    test("validates config schema", () => {
      expect(() =>
        DevContainerConfigSchema.parse({
          sandboxId: "test",
          projectPath: "/path/to/project",
        })
      ).not.toThrow();
    });

    test("rejects invalid config", () => {
      expect(() =>
        DevContainerConfigSchema.parse({
          sandboxId: "", // Invalid
          projectPath: "/path",
        })
      ).toThrow();
    });
  });

  describe("ensureDevScript", () => {
    test("adds dev script if missing", async () => {
      // Create temp package.json without dev script
      const result = await ensureDevScript(tempDir);
      // Verify dev script was added
    });

    test("preserves existing dev script", async () => {
      // Create temp package.json with existing dev script
      const original = { scripts: { dev: "custom-command" } };
      await ensureDevScript(tempDir);
      // Verify original script preserved
    });
  });
});
```

### Integration Tests (`sandbox-dev-container.integration.test.ts`)

```typescript
describe("DevContainerManager Integration", () => {
  // REQUIRES: Docker running

  let manager: DevContainerManager;
  let testSandboxId: string;

  beforeAll(async () => {
    manager = createDevContainerManager();
    testSandboxId = `test-${Date.now()}`;
    
    // Create test project
    await createTestProject(testSandboxId);
  });

  afterAll(async () => {
    await manager.stop(testSandboxId);
    await cleanupTestProject(testSandboxId);
  });

  test("starts dev container", async () => {
    const info = await manager.start({
      sandboxId: testSandboxId,
      projectPath: getTestProjectPath(testSandboxId),
    });

    expect(info.status).toBe("running");
    expect(info.url).toMatch(/http:\/\/localhost:\d+/);
  });

  test("file changes trigger HMR", async () => {
    // Modify a file
    await modifyTestFile(testSandboxId, "src/App.tsx");

    // Wait for HMR
    await sleep(2000);

    // Verify the change is reflected
    const response = await fetch(`http://localhost:${info.port}`);
    expect(response.ok).toBe(true);
  });

  test("survives syntax errors", async () => {
    // Introduce a syntax error
    await writeBrokenFile(testSandboxId);

    // Wait a bit
    await sleep(3000);

    // Container should still be running (or restarting)
    const status = await manager.getStatus(testSandboxId);
    expect(["running", "restarting"]).toContain(status?.status);

    // Fix the error
    await fixBrokenFile(testSandboxId);

    // Should recover
    await sleep(3000);
    const newStatus = await manager.getStatus(testSandboxId);
    expect(newStatus?.status).toBe("running");
  });

  test("can install packages", async () => {
    const result = await manager.installPackages(testSandboxId, ["lodash"]);
    expect(result.success).toBe(true);
  });
});
```

## Definition of Done

- [ ] Dev container starts with volume mount
- [ ] File changes reflect via HMR within 2 seconds
- [ ] Container survives and recovers from syntax errors
- [ ] Container logs are streamable
- [ ] Can execute commands inside container
- [ ] Can install npm packages
- [ ] Unit tests pass
- [ ] Integration tests pass with real Docker
- [ ] Works on macOS, Linux, and Windows (Docker Desktop)
- [ ] Vite config optimized for Docker environment
