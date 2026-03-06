/**
 * Sandbox Dev Container - Development mode for sandboxes with volume mount
 *
 * Enables live code editing in sandboxes by mounting the project directory as a volume.
 * Changes to files are immediately reflected in the running container without rebuilding.
 */

import Docker from "dockerode";
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";

// ==================== CONFIGURATION ====================

// Input schema - what users provide
const DevContainerConfigInputSchema = z.object({
  sandboxId: z.string().min(1),
  projectPath: z.string().min(1), // Absolute path to sandbox directory
  port: z.number().optional(),
  enableHmr: z.boolean().optional(),
  watchOptions: z
    .object({
      usePolling: z.boolean().optional(),
      pollInterval: z.number().optional(),
    })
    .optional(),
});

// Schema with defaults applied - for validation
export const DevContainerConfigSchema = DevContainerConfigInputSchema.transform((input) => ({
  ...input,
  port: input.port ?? 3000,
  enableHmr: input.enableHmr ?? true,
  watchOptions: input.watchOptions
    ? {
        usePolling: input.watchOptions.usePolling ?? false,
        pollInterval: input.watchOptions.pollInterval ?? 100,
      }
    : undefined,
}));

export type DevContainerConfig = z.input<typeof DevContainerConfigSchema>;

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

// ==================== IMPLEMENTATION ====================

const DEV_CONTAINER_PREFIX = "crayon-dev-";
const BASE_DEV_IMAGE = "crayon-dev-base:latest";

export class DevContainerManagerImpl implements DevContainerManager {
  private readonly docker: Docker;

  constructor(docker?: Docker) {
    this.docker = docker ?? new Docker();
  }

  /**
   * Ensure the base dev image exists
   */
  private async ensureBaseImageExists(): Promise<void> {
    try {
      await this.docker.getImage(BASE_DEV_IMAGE).inspect();
      console.log("[DevContainer] Base image exists");
    } catch {
      console.log("[DevContainer] Building base image...");

      // Create a simple Dockerfile for the base image
      const dockerfile = `FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
EXPOSE 3000
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]`;

      // Build the image using tar stream
      const tarStream = await this.createTarWithDockerfile(dockerfile);
      const buildStream = await this.docker.buildImage(tarStream, {
        t: BASE_DEV_IMAGE,
      });

      // Wait for build to complete
      await this.waitForBuild(buildStream);
      console.log("[DevContainer] Base image built successfully");
    }
  }

  /**
   * Create a tar stream with a Dockerfile
   */
  private async createTarWithDockerfile(
    dockerfileContent: string
  ): Promise<NodeJS.ReadableStream> {
    const tar = await import("tar-stream");
    const pack = tar.pack();

    pack.entry({ name: "Dockerfile" }, dockerfileContent);
    pack.finalize();

    return pack;
  }

  /**
   * Wait for Docker build to complete
   */
  private async waitForBuild(stream: NodeJS.ReadableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        // Parse and log build progress
        try {
          const data = JSON.parse(chunk.toString());
          if (data.stream) {
            process.stdout.write(data.stream);
          }
          if (data.error) {
            reject(new Error(data.error));
          }
        } catch {
          // Ignore parsing errors
        }
      });

      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
  }

  /**
   * Ensure dev script exists in package.json
   */
  private async ensureDevScript(projectPath: string): Promise<void> {
    const packageJsonPath = path.join(projectPath, "package.json");

    try {
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
    } catch (error) {
      throw new Error(
        `Failed to ensure dev script: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for Vite server to be ready
   */
  private async waitForViteReady(
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

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Vite server did not start within ${timeout}ms`);
  }

  /**
   * Get container info from Docker container
   */
  private async getContainerInfo(
    sandboxId: string,
    container: Docker.Container
  ): Promise<DevContainerInfo> {
    const info = await container.inspect();

    const status = this.mapContainerStatus(info.State);
    const port = this.extractPort(info);
    const uptime = info.State.StartedAt
      ? Math.floor(
          (Date.now() - new Date(info.State.StartedAt).getTime()) / 1000
        )
      : 0;

    // Get restart count
    const restartCount = info.RestartCount ?? 0;

    // Get last error if any
    const lastError = info.State.Error || undefined;

    // Get resource usage (optional - requires stats API)
    let memoryUsage: number | undefined;
    let cpuPercent: number | undefined;

    try {
      const stats = await container.stats({ stream: false });
      memoryUsage = Math.floor(
        (stats as { memory_stats?: { usage?: number } }).memory_stats?.usage ??
          0 / (1024 * 1024)
      );
      // CPU calculation would be more complex, skipping for now
    } catch {
      // Stats not available
    }

    return {
      sandboxId,
      containerId: info.Id,
      status,
      port,
      url: `http://localhost:${port}`,
      uptime,
      restartCount,
      lastError,
      memoryUsage,
      cpuPercent,
    };
  }

  /**
   * Map Docker container state to DevContainerStatus
   */
  private mapContainerStatus(
    state: Docker.ContainerInspectInfo["State"]
  ): DevContainerStatus {
    if (state.Running) {
      return "running";
    }
    if (state.Restarting) {
      return "restarting";
    }
    if (state.Status === "created") {
      return "starting";
    }
    if (state.ExitCode !== 0 && state.ExitCode !== undefined) {
      return "error";
    }
    return "stopped";
  }

  /**
   * Extract host port from container inspect info
   */
  private extractPort(info: Docker.ContainerInspectInfo): number {
    const portBindings = info.HostConfig?.PortBindings ?? {};
    const binding = portBindings["3000/tcp"]?.[0];
    return binding?.HostPort ? parseInt(binding.HostPort, 10) : 3000;
  }

  /**
   * Start a dev container with volume mount
   */
  async start(config: DevContainerConfig): Promise<DevContainerInfo> {
    const validated = DevContainerConfigSchema.parse(config);

    await this.ensureBaseImageExists();

    const containerName = `${DEV_CONTAINER_PREFIX}${validated.sandboxId}`;

    // Check if container already exists
    try {
      const existing = this.docker.getContainer(containerName);
      const info = await existing.inspect();

      if (info.State.Running) {
        // Already running, return info
        return this.getContainerInfo(validated.sandboxId, existing);
      }

      // Exists but stopped, remove and recreate
      await existing.remove();
    } catch {
      // Container doesn't exist, continue
    }

    // Resolve absolute path
    const absolutePath = path.resolve(validated.projectPath);

    // Ensure package.json has dev script
    await this.ensureDevScript(absolutePath);

    // Create container with volume mount
    const container = await this.docker.createContainer({
      Image: BASE_DEV_IMAGE,
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
    try {
      await this.waitForViteReady(validated.port);
    } catch (error) {
      console.warn(
        `[DevContainer] Vite server check timed out: ${error instanceof Error ? error.message : String(error)}`
      );
      // Continue anyway, container is started
    }

    return this.getContainerInfo(validated.sandboxId, container);
  }

  /**
   * Stop a running dev container
   */
  async stop(sandboxId: string): Promise<void> {
    const containerName = `${DEV_CONTAINER_PREFIX}${sandboxId}`;

    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();

      if (!info.State.Running) {
        // Already stopped
        return;
      }

      await container.stop();
    } catch (error) {
      if (this.isNotFoundError(error)) {
        // Container doesn't exist, that's fine
        return;
      }
      throw error;
    }
  }

  /**
   * Restart the dev container
   */
  async restart(sandboxId: string): Promise<DevContainerInfo> {
    const containerName = `${DEV_CONTAINER_PREFIX}${sandboxId}`;

    try {
      const container = this.docker.getContainer(containerName);
      await container.restart();

      return this.getContainerInfo(sandboxId, container);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new Error(`Dev container '${sandboxId}' not found`);
      }
      throw error;
    }
  }

  /**
   * Get current status of a dev container
   */
  async getStatus(sandboxId: string): Promise<DevContainerInfo | null> {
    const containerName = `${DEV_CONTAINER_PREFIX}${sandboxId}`;

    try {
      const container = this.docker.getContainer(containerName);
      return this.getContainerInfo(sandboxId, container);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all running dev containers
   */
  async list(): Promise<DevContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          name: [DEV_CONTAINER_PREFIX],
        },
      });

      const devContainers: DevContainerInfo[] = [];

      for (const containerInfo of containers) {
        // Extract sandbox ID from container name
        const name = containerInfo.Names[0]?.replace(/^\//, "") ?? "";
        if (!name.startsWith(DEV_CONTAINER_PREFIX)) {
          continue;
        }

        const sandboxId = name.slice(DEV_CONTAINER_PREFIX.length);
        const container = this.docker.getContainer(containerInfo.Id);
        const info = await this.getContainerInfo(sandboxId, container);
        devContainers.push(info);
      }

      return devContainers;
    } catch (error) {
      throw new Error(
        `Failed to list dev containers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Stream container logs
   */
  async *streamLogs(
    sandboxId: string,
    options?: { tail?: number; follow?: boolean }
  ): AsyncGenerator<LogEntry> {
    const containerName = `${DEV_CONTAINER_PREFIX}${sandboxId}`;
    const container = this.docker.getContainer(containerName);

    const follow = options?.follow ?? true;

    if (follow) {
      // Stream mode
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: options?.tail ?? 100,
        timestamps: true,
      });

      // Stream mode returns ReadableStream
      const readableStream = stream as unknown as NodeJS.ReadableStream;
      for await (const chunk of readableStream) {
        const buffer = chunk as Buffer;
        const lines = buffer.toString().split("\n").filter(Boolean);

        for (const line of lines) {
          // Docker log format includes timestamp
          const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
          const timestamp = timestampMatch
            ? new Date(timestampMatch[1])
            : new Date();

          const message = timestampMatch
            ? line.slice(timestampMatch[0].length).trim()
            : line;

          // Determine stream type from Docker header (first byte)
          // 1 = stdout, 2 = stderr
          const streamType = buffer[0] === 1 ? "stdout" : "stderr";

          yield {
            timestamp,
            stream: streamType,
            message,
          };
        }
      }
    } else {
      // Non-follow mode returns Buffer
      const buffer = await container.logs({
        follow: false,
        stdout: true,
        stderr: true,
        tail: options?.tail ?? 100,
        timestamps: true,
      });

      const lines = buffer.toString().split("\n").filter(Boolean);

      for (const line of lines) {
        // Docker log format includes timestamp
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
        const timestamp = timestampMatch
          ? new Date(timestampMatch[1])
          : new Date();

        const message = timestampMatch
          ? line.slice(timestampMatch[0].length).trim()
          : line;

        yield {
          timestamp,
          stream: "stdout",
          message,
        };
      }
    }
  }

  /**
   * Execute a command in the container
   */
  async exec(
    sandboxId: string,
    command: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerName = `${DEV_CONTAINER_PREFIX}${sandboxId}`;
    const container = this.docker.getContainer(containerName);

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = (await exec.start({
      hijack: true,
      stdin: false,
    })) as NodeJS.ReadableStream;

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";

      this.docker.modem.demuxStream(
        stream,
        {
          write: (chunk: Buffer) => {
            stdout += chunk.toString();
          },
        } as NodeJS.WritableStream,
        {
          write: (chunk: Buffer) => {
            stderr += chunk.toString();
          },
        } as NodeJS.WritableStream
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

  /**
   * Install npm packages in the container
   */
  async installPackages(
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
    const result = await this.exec(sandboxId, command);

    return {
      success: result.exitCode === 0,
      output: result.stdout + result.stderr,
    };
  }

  /**
   * Check if error is a "not found" error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("no such container") ||
        message.includes("not found") ||
        (error as { statusCode?: number }).statusCode === 404
      );
    }
    return false;
  }
}

/**
 * Create a dev container manager instance
 */
export function createDevContainerManager(): DevContainerManager {
  return new DevContainerManagerImpl();
}
