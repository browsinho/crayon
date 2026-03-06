/**
 * Sandbox Manager - Manages sandbox container lifecycle via Docker API
 *
 * Provides methods to start, stop, get status, and list sandbox containers.
 * Uses dockerode for container management with proper port allocation.
 */

import Docker from "dockerode";
import * as net from "net";
import type { Sandbox, SandboxStatus } from "@crayon/types";
import { buildFrontendOnly } from "./docker-builder.js";
import { createDevContainerManager } from "./sandbox-dev-container.js";

const CONTAINER_PREFIX = "crayon-sandbox-";
const BASE_FRONTEND_PORT = 8080;
const BASE_BACKEND_PORT = 8081;

export type SandboxMode = "production" | "development";

export interface SandboxManagerConfig {
  docker?: Docker;
}

export class SandboxManagerError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "DOCKER_ERROR" | "DOCKER_UNAVAILABLE" | "ALREADY_RUNNING" | "ALREADY_STOPPED"
  ) {
    super(message);
    this.name = "SandboxManagerError";
  }
}

/**
 * Create a Sandbox Manager instance
 */
export function createSandboxManager(config: SandboxManagerConfig = {}): SandboxManager {
  return new SandboxManager(config);
}

export class SandboxManager {
  private readonly docker: Docker;

  constructor(config: SandboxManagerConfig = {}) {
    this.docker = config.docker ?? new Docker();
  }

  /**
   * Check if Docker daemon is available and reachable
   */
  async checkDockerAvailable(): Promise<void> {
    try {
      await this.docker.ping();
    } catch {
      throw new SandboxManagerError(
        "Docker is not available. Please ensure Docker Desktop is running.",
        "DOCKER_UNAVAILABLE"
      );
    }
  }

  /**
   * Check if a Docker image exists for the given sandbox
   */
  async imageExists(sandboxId: string): Promise<boolean> {
    const imageName = `${CONTAINER_PREFIX}${sandboxId}`;
    try {
      const image = this.docker.getImage(imageName);
      await image.inspect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build the Docker image if it doesn't exist, then start the container
   */
  async buildAndStart(
    sandboxId: string,
    projectDir: string,
    options: { mode?: SandboxMode } = {}
  ): Promise<Sandbox> {
    await this.checkDockerAvailable();
    const mode = options.mode ?? "development"; // Default to dev mode

    if (mode === "development") {
      // Use dev container manager
      const devManager = createDevContainerManager();
      const port = await this.allocateSinglePort();
      const info = await devManager.start({
        sandboxId,
        projectPath: projectDir,
        port,
      });

      return {
        id: sandboxId,
        status: "running",
        ports: { frontend: info.port, backend: 0 },
        url: info.url,
      };
    }

    // Production mode: build image and start container
    const imageExists = await this.imageExists(sandboxId);

    if (!imageExists) {
      // Build the image first
      await buildFrontendOnly(sandboxId, projectDir);
    }

    // Start the container
    return this.start(sandboxId);
  }

  /**
   * Start a sandbox container
   */
  async start(sandboxId: string): Promise<Sandbox> {
    await this.checkDockerAvailable();
    const containerName = `${CONTAINER_PREFIX}${sandboxId}`;
    const imageName = `${CONTAINER_PREFIX}${sandboxId}`;

    // Check if container already exists
    try {
      const existingContainer = this.docker.getContainer(containerName);
      const info = await existingContainer.inspect();

      if (info.State.Running) {
        // Already running, return current state
        const ports = this.extractPorts(info);
        return {
          id: sandboxId,
          status: "running",
          ports,
          url: `http://localhost:${ports.frontend}`,
        };
      }

      // Container exists but is stopped - start it
      await existingContainer.start();

      // Wait briefly for it to start
      await this.waitForStatus(sandboxId, "running", 5000);

      const updatedInfo = await existingContainer.inspect();
      const ports = this.extractPorts(updatedInfo);

      return {
        id: sandboxId,
        status: "running",
        ports,
        url: `http://localhost:${ports.frontend}`,
      };
    } catch (error) {
      // Container doesn't exist, need to create it
      if (this.isNotFoundError(error)) {
        // Allocate ports based on existing sandboxes and OS-level availability
        const existingPorts = await this.getAllocatedPorts();
        const { frontend, backend } = await this.allocatePorts(existingPorts);

        // Create container
        const container = await this.docker.createContainer({
          Image: imageName,
          name: containerName,
          ExposedPorts: {
            "3000/tcp": {},
            "3001/tcp": {},
          },
          HostConfig: {
            PortBindings: {
              "3000/tcp": [{ HostPort: String(frontend) }],
              "3001/tcp": [{ HostPort: String(backend) }],
            },
          },
        });

        // Start the container
        await container.start();

        return {
          id: sandboxId,
          status: "running",
          ports: { frontend, backend },
          url: `http://localhost:${frontend}`,
        };
      }

      throw new SandboxManagerError(
        `Failed to start sandbox: ${error instanceof Error ? error.message : String(error)}`,
        "DOCKER_ERROR"
      );
    }
  }

  /**
   * Stop a running sandbox container
   */
  async stop(sandboxId: string): Promise<void> {
    const containerName = `${CONTAINER_PREFIX}${sandboxId}`;

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
        throw new SandboxManagerError(
          `Sandbox '${sandboxId}' not found`,
          "NOT_FOUND"
        );
      }

      throw new SandboxManagerError(
        `Failed to stop sandbox: ${error instanceof Error ? error.message : String(error)}`,
        "DOCKER_ERROR"
      );
    }
  }

  /**
   * Get the status of a sandbox
   */
  async getStatus(sandboxId: string): Promise<Sandbox> {
    const containerName = `${CONTAINER_PREFIX}${sandboxId}`;

    try {
      const container = this.docker.getContainer(containerName);
      const info = await container.inspect();

      const status = this.mapContainerStatus(info.State);
      const ports = this.extractPorts(info);

      return {
        id: sandboxId,
        status,
        ports,
        url: status === "running" ? `http://localhost:${ports.frontend}` : undefined,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new SandboxManagerError(
          `Sandbox '${sandboxId}' not found`,
          "NOT_FOUND"
        );
      }

      throw new SandboxManagerError(
        `Failed to get sandbox status: ${error instanceof Error ? error.message : String(error)}`,
        "DOCKER_ERROR"
      );
    }
  }

  /**
   * List all sandbox containers
   */
  async list(): Promise<Sandbox[]> {
    await this.checkDockerAvailable();
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          name: [CONTAINER_PREFIX],
        },
      });

      const sandboxes: Sandbox[] = [];

      for (const containerInfo of containers) {
        // Extract sandbox ID from container name
        const name = containerInfo.Names[0]?.replace(/^\//, "") ?? "";
        if (!name.startsWith(CONTAINER_PREFIX)) {
          continue;
        }

        const sandboxId = name.slice(CONTAINER_PREFIX.length);
        const status = this.mapListContainerStatus(containerInfo.State);
        const ports = this.extractPortsFromList(containerInfo.Ports);

        sandboxes.push({
          id: sandboxId,
          status,
          ports,
          url: status === "running" ? `http://localhost:${ports.frontend}` : undefined,
        });
      }

      return sandboxes;
    } catch (error) {
      throw new SandboxManagerError(
        `Failed to list sandboxes: ${error instanceof Error ? error.message : String(error)}`,
        "DOCKER_ERROR"
      );
    }
  }

  /**
   * Extract host ports from container inspect info
   */
  private extractPorts(info: Docker.ContainerInspectInfo): { frontend: number; backend: number } {
    const portBindings = info.HostConfig?.PortBindings ?? {};

    const frontendBinding = portBindings["3000/tcp"]?.[0];
    const backendBinding = portBindings["3001/tcp"]?.[0];

    const frontend = frontendBinding?.HostPort
      ? parseInt(frontendBinding.HostPort, 10)
      : BASE_FRONTEND_PORT;
    const backend = backendBinding?.HostPort
      ? parseInt(backendBinding.HostPort, 10)
      : BASE_BACKEND_PORT;

    return { frontend, backend };
  }

  /**
   * Extract ports from list container info
   */
  private extractPortsFromList(
    ports: Docker.ContainerInfo["Ports"]
  ): { frontend: number; backend: number } {
    let frontend = BASE_FRONTEND_PORT;
    let backend = BASE_BACKEND_PORT;

    for (const port of ports) {
      if (port.PrivatePort === 3000 && port.PublicPort) {
        frontend = port.PublicPort;
      } else if (port.PrivatePort === 3001 && port.PublicPort) {
        backend = port.PublicPort;
      }
    }

    return { frontend, backend };
  }

  /**
   * Map Docker container state to SandboxStatus
   */
  private mapContainerStatus(state: Docker.ContainerInspectInfo["State"]): SandboxStatus {
    if (state.Running) {
      return "running";
    }
    if (state.Restarting) {
      return "starting";
    }
    if (state.ExitCode !== 0 && state.ExitCode !== undefined) {
      return "error";
    }
    return "stopped";
  }

  /**
   * Map list container state to SandboxStatus
   */
  private mapListContainerStatus(state: string): SandboxStatus {
    const stateLower = state.toLowerCase();
    if (stateLower === "running") {
      return "running";
    }
    if (stateLower === "restarting" || stateLower === "created") {
      return "starting";
    }
    if (stateLower === "dead" || stateLower === "removing") {
      return "error";
    }
    return "stopped";
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

  /**
   * Get all currently allocated ports
   */
  private async getAllocatedPorts(): Promise<Set<number>> {
    const sandboxes = await this.list();
    const ports = new Set<number>();

    for (const sandbox of sandboxes) {
      ports.add(sandbox.ports.frontend);
      ports.add(sandbox.ports.backend);
    }

    return ports;
  }

  /**
   * Check if a port is available for binding at the OS level
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close();
        resolve(true);
      });
      server.listen(port, "0.0.0.0");
    });
  }

  /**
   * Allocate new ports for a sandbox
   */
  private async allocatePorts(allocatedPorts: Set<number>): Promise<{ frontend: number; backend: number }> {
    for (let offset = 0; offset < 1000; offset++) {
      const frontend = BASE_FRONTEND_PORT + offset * 10;
      const backend = BASE_BACKEND_PORT + offset * 10;

      // Check if ports are used by other Docker containers
      if (allocatedPorts.has(frontend) || allocatedPorts.has(backend)) {
        continue;
      }

      // Check if ports are actually available at OS level
      const frontendAvailable = await this.isPortAvailable(frontend);
      const backendAvailable = await this.isPortAvailable(backend);

      if (frontendAvailable && backendAvailable) {
        return { frontend, backend };
      }
    }

    throw new SandboxManagerError(
      "Unable to allocate ports: all port ranges exhausted",
      "DOCKER_ERROR"
    );
  }

  /**
   * Allocate a single port (for dev mode)
   */
  private async allocateSinglePort(): Promise<number> {
    const allocatedPorts = await this.getAllocatedPorts();

    for (let offset = 0; offset < 1000; offset++) {
      const port = BASE_FRONTEND_PORT + offset * 10;

      // Check if port is used by other Docker containers
      if (allocatedPorts.has(port)) {
        continue;
      }

      // Check if port is actually available at OS level
      const available = await this.isPortAvailable(port);

      if (available) {
        return port;
      }
    }

    throw new SandboxManagerError(
      "Unable to allocate port: all port ranges exhausted",
      "DOCKER_ERROR"
    );
  }

  /**
   * Wait for a sandbox to reach a specific status
   */
  private async waitForStatus(
    sandboxId: string,
    targetStatus: SandboxStatus,
    timeoutMs: number
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const sandbox = await this.getStatus(sandboxId);
        if (sandbox.status === targetStatus) {
          return;
        }
      } catch {
        // Ignore errors while waiting
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
