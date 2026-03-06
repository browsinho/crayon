import path from "node:path";
import fs from "node:fs";
import type { SandboxManager } from "@crayon/core";

export interface SandboxInfo {
  sandboxPath: string;
  containerId?: string;
  status: "running" | "stopped" | "error";
}

export async function resolveSandbox(
  sandboxId: string,
  dataDir: string,
  sandboxManager: SandboxManager
): Promise<SandboxInfo | null> {
  // Validate sandboxId format (prevent path traversal)
  if (!/^[a-zA-Z0-9_-]+$/.test(sandboxId)) {
    return null;
  }

  // Check if sandbox directory exists
  const sandboxPath = path.join(dataDir, "projects", sandboxId, "sandbox");

  if (!fs.existsSync(sandboxPath)) {
    return null;
  }

  // Get container status from sandbox manager
  try {
    const sandbox = await sandboxManager.getStatus(sandboxId);

    return {
      sandboxPath: path.resolve(sandboxPath),
      containerId: sandbox.id,
      status: sandbox.status === "running" ? "running" : "stopped",
    };
  } catch {
    // Sandbox exists but container not running
    return {
      sandboxPath: path.resolve(sandboxPath),
      status: "stopped",
    };
  }
}
