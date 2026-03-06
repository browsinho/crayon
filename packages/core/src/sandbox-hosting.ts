/**
 * Sandbox Hosting - Provides URLs and metadata for accessing sandboxes
 *
 * Manages sandbox URLs, hosting status, and provides methods to
 * start/stop hosting and list all hosted sandboxes.
 */

import type { SandboxHost } from "@crayon/types";
import { SandboxManager } from "./sandbox-manager.js";

export interface SandboxHostingConfig {
  /**
   * Base URL for the hosting service (e.g., "http://localhost:3000")
   */
  baseUrl: string;

  /**
   * Sandbox manager instance
   */
  sandboxManager?: SandboxManager;
}

export class SandboxHostingError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "ALREADY_HOSTED" | "MANAGER_ERROR"
  ) {
    super(message);
    this.name = "SandboxHostingError";
  }
}

/**
 * Create a Sandbox Hosting instance
 */
export function createSandboxHosting(config: SandboxHostingConfig): SandboxHosting {
  return new SandboxHosting(config);
}

export class SandboxHosting {
  private readonly baseUrl: string;
  private readonly sandboxManager: SandboxManager;

  constructor(config: SandboxHostingConfig) {
    this.baseUrl = config.baseUrl;
    this.sandboxManager = config.sandboxManager ?? new SandboxManager();
  }

  /**
   * Start hosting a sandbox
   * Returns the hosted sandbox with its URL
   */
  async startHosting(sandboxId: string): Promise<SandboxHost> {
    try {
      // Start the sandbox container
      const sandbox = await this.sandboxManager.start(sandboxId);

      // Generate the proxy URL
      const url = this.getSandboxUrl(sandboxId);

      // Get container ID
      const containerId = `crayon-sandbox-${sandboxId}`;

      return {
        sandboxId,
        url,
        status: this.mapStatus(sandbox.status),
        container: {
          id: containerId,
          ports: {
            frontend: sandbox.ports.frontend,
            backend: sandbox.ports.backend,
          },
        },
      };
    } catch (error) {
      throw new SandboxHostingError(
        `Failed to start hosting sandbox: ${error instanceof Error ? error.message : String(error)}`,
        "MANAGER_ERROR"
      );
    }
  }

  /**
   * Stop hosting a sandbox
   */
  async stopHosting(sandboxId: string): Promise<void> {
    try {
      await this.sandboxManager.stop(sandboxId);
    } catch (error) {
      throw new SandboxHostingError(
        `Failed to stop hosting sandbox: ${error instanceof Error ? error.message : String(error)}`,
        "MANAGER_ERROR"
      );
    }
  }

  /**
   * Get the URL for a sandbox
   */
  getSandboxUrl(sandboxId: string): string {
    // Using reverse proxy pattern: /api/sandbox/{sandboxId}/proxy
    return `${this.baseUrl}/api/sandbox/${sandboxId}/proxy`;
  }

  /**
   * List all hosted sandboxes
   */
  async listHosted(): Promise<SandboxHost[]> {
    try {
      const sandboxes = await this.sandboxManager.list();

      return sandboxes.map((sandbox) => {
        const url = this.getSandboxUrl(sandbox.id);
        const containerId = `crayon-sandbox-${sandbox.id}`;

        return {
          sandboxId: sandbox.id,
          url,
          status: this.mapStatus(sandbox.status),
          container: {
            id: containerId,
            ports: {
              frontend: sandbox.ports.frontend,
              backend: sandbox.ports.backend,
            },
          },
        };
      });
    } catch (error) {
      throw new SandboxHostingError(
        `Failed to list hosted sandboxes: ${error instanceof Error ? error.message : String(error)}`,
        "MANAGER_ERROR"
      );
    }
  }

  /**
   * Get hosting information for a specific sandbox
   */
  async getHostInfo(sandboxId: string): Promise<SandboxHost> {
    try {
      const sandbox = await this.sandboxManager.getStatus(sandboxId);
      const url = this.getSandboxUrl(sandboxId);
      const containerId = `crayon-sandbox-${sandboxId}`;

      return {
        sandboxId,
        url,
        status: this.mapStatus(sandbox.status),
        container: {
          id: containerId,
          ports: {
            frontend: sandbox.ports.frontend,
            backend: sandbox.ports.backend,
          },
        },
      };
    } catch {
      throw new SandboxHostingError(
        `Sandbox '${sandboxId}' not found`,
        "NOT_FOUND"
      );
    }
  }

  /**
   * Map SandboxStatus to SandboxHost status
   */
  private mapStatus(
    status: "running" | "stopped" | "starting" | "error"
  ): "running" | "stopped" | "error" {
    if (status === "starting") {
      return "running"; // Treat starting as running for hosting purposes
    }
    return status;
  }
}
