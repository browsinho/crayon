"use server";

import * as fs from "fs";
import * as path from "path";
import { getCrayonService } from "@/lib/crayon";
import type { Sandbox } from "@crayon/types";
import { revalidatePath } from "next/cache";
import type {
  FileNode,
  TableColumn,
  TableRow,
  McpConfig,
  CheckpointData,
} from "@/app/project/[id]/sandbox/components/types";

// Security: Validate sandboxId to prevent path traversal
function validateSandboxId(sandboxId: string): void {
  // Allow only alphanumeric, hyphens, and underscores (typical UUID/ID format)
  if (!/^[a-zA-Z0-9_-]+$/.test(sandboxId)) {
    throw new Error("Invalid sandbox ID");
  }
}

export type SandboxActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: "DOCKER_UNAVAILABLE" | "NOT_FOUND" | "ERROR" };

export async function checkSandboxFiles(projectId: string): Promise<boolean> {
  const sandboxPath = `./data/projects/${projectId}/sandbox`;
  return fs.existsSync(sandboxPath);
}

export async function getSandbox(projectId: string): Promise<SandboxActionResult<Sandbox | null>> {
  try {
    const service = getCrayonService();
    const sandbox = await service.getSandbox(projectId);
    return { success: true, data: sandbox };
  } catch (error) {
    if (error instanceof Error && 'code' in error &&
        (error as { code: string }).code === "DOCKER_UNAVAILABLE") {
      return {
        success: false,
        error: "Docker is not available. Please ensure Docker Desktop is running.",
        code: "DOCKER_UNAVAILABLE"
      };
    }
    return { success: false, error: "Failed to get sandbox status", code: "ERROR" };
  }
}

export async function startSandbox(projectId: string): Promise<SandboxActionResult<Sandbox>> {
  try {
    const service = getCrayonService();

    // Get project to verify it exists
    const project = await service.getProject(projectId);
    if (!project) {
      return { success: false, error: "Project not found", code: "NOT_FOUND" };
    }

    const sandboxPath = `./data/projects/${projectId}/sandbox`;

    // Check if sandbox files exist
    if (!fs.existsSync(sandboxPath)) {
      return {
        success: false,
        error: "No sandbox files found. Please generate the project first.",
        code: "NOT_FOUND"
      };
    }

    // Build (if needed) and start
    const sandbox = await service.buildAndStartSandbox(projectId, sandboxPath);
    revalidatePath(`/project/${projectId}`);
    revalidatePath(`/project/${projectId}/sandbox`);
    return { success: true, data: sandbox };
  } catch (error) {
    if (error instanceof Error && 'code' in error &&
        (error as { code: string }).code === "DOCKER_UNAVAILABLE") {
      return {
        success: false,
        error: "Docker is not available. Please ensure Docker Desktop is running.",
        code: "DOCKER_UNAVAILABLE"
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start sandbox",
      code: "ERROR"
    };
  }
}

export async function stopSandbox(projectId: string): Promise<void> {
  const service = getCrayonService();
  await service.stopSandbox(projectId);
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/sandbox`);
}

export async function restartSandbox(projectId: string): Promise<Sandbox> {
  const service = getCrayonService();
  const sandbox = await service.restartSandbox(projectId);
  revalidatePath(`/project/${projectId}`);
  revalidatePath(`/project/${projectId}/sandbox`);
  return sandbox;
}

// File operations
function buildFileTree(basePath: string, relativePath: string): FileNode[] {
  const fullPath = relativePath ? path.join(basePath, relativePath) : basePath;
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip hidden files, node_modules, and symlinks (security: prevent escaping sandbox)
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.isSymbolicLink()) {
      continue;
    }

    const entryRelativePath = relativePath
      ? path.join(relativePath, entry.name)
      : entry.name;

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: entryRelativePath,
        type: "directory",
        children: buildFileTree(basePath, entryRelativePath),
      });
    } else {
      nodes.push({
        name: entry.name,
        path: entryRelativePath,
        type: "file",
      });
    }
  }

  // Sort: directories first, then files, alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function getSandboxFiles(sandboxId: string): Promise<FileNode[]> {
  validateSandboxId(sandboxId);
  const sandboxPath = `./data/projects/${sandboxId}/sandbox`;

  if (!fs.existsSync(sandboxPath)) {
    return [];
  }

  return buildFileTree(sandboxPath, "");
}

export async function getSandboxFileContent(
  sandboxId: string,
  filePath: string
): Promise<string> {
  validateSandboxId(sandboxId);
  const sandboxPath = `./data/projects/${sandboxId}/sandbox`;

  // Security: Prevent path traversal attacks
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.includes("..") || path.isAbsolute(normalizedPath)) {
    throw new Error("Invalid file path");
  }

  const fullPath = path.join(sandboxPath, normalizedPath);

  // Security: Verify path is within sandbox directory (resolves symlinks)
  let resolvedPath: string;
  let resolvedSandboxPath: string;
  try {
    resolvedSandboxPath = fs.realpathSync(sandboxPath);
    resolvedPath = fs.realpathSync(fullPath);
  } catch {
    throw new Error("Invalid file path");
  }
  if (!resolvedPath.startsWith(resolvedSandboxPath + path.sep) && resolvedPath !== resolvedSandboxPath) {
    throw new Error("Invalid file path");
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(fullPath);
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  return fs.readFileSync(fullPath, "utf-8");
}

// Database operations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getSandboxTables(sandboxId: string): Promise<string[]> {
  // TODO: Implement actual table fetching from sandbox database
  return ["products", "users", "orders", "categories"];
}

export async function getSandboxTableData(
  sandboxId: string,
  tableName: string
): Promise<{ columns: TableColumn[]; rows: TableRow[] }> {
  // TODO: Implement actual data fetching from sandbox database
  const mockData: Record<string, { columns: TableColumn[]; rows: TableRow[] }> = {
    products: {
      columns: [
        { name: "name", type: "string" },
        { name: "price", type: "number" },
        { name: "stock", type: "number" },
        { name: "category", type: "string" },
      ],
      rows: [
        { id: "1", data: { name: "Wireless Mouse", price: 29.99, stock: 150, category: "Tech" } },
        { id: "2", data: { name: "Keyboard Pro", price: 79.99, stock: 85, category: "Tech" } },
        { id: "3", data: { name: "USB-C Hub", price: 49.99, stock: 200, category: "Tech" } },
      ],
    },
    users: {
      columns: [
        { name: "email", type: "string" },
        { name: "name", type: "string" },
        { name: "role", type: "string" },
      ],
      rows: [
        { id: "1", data: { email: "admin@example.com", name: "Admin User", role: "admin" } },
        { id: "2", data: { email: "user@example.com", name: "Test User", role: "user" } },
      ],
    },
    orders: {
      columns: [
        { name: "userId", type: "string" },
        { name: "total", type: "number" },
        { name: "status", type: "string" },
      ],
      rows: [
        { id: "1", data: { userId: "2", total: 109.98, status: "completed" } },
      ],
    },
    categories: {
      columns: [
        { name: "name", type: "string" },
        { name: "description", type: "string" },
      ],
      rows: [
        { id: "1", data: { name: "Tech", description: "Technology products" } },
        { id: "2", data: { name: "Home", description: "Home products" } },
      ],
    },
  };

  return mockData[tableName] ?? { columns: [], rows: [] };
}

export async function createSandboxRow(
  sandboxId: string,
  tableName: string,
  data: Record<string, unknown>
): Promise<void> {
  // TODO: Implement actual row creation in sandbox database
}

export async function updateSandboxRow(
  sandboxId: string,
  tableName: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<void> {
  // TODO: Implement actual row update in sandbox database
}

export async function deleteSandboxRow(
  sandboxId: string,
  tableName: string,
  rowId: string
): Promise<void> {
  // TODO: Implement actual row deletion in sandbox database
}

// MCP configuration
export async function getSandboxMcpConfig(sandboxId: string): Promise<McpConfig> {
  validateSandboxId(sandboxId);

  const { getOrCreateApiKey, createToolRegistry } = await import("@crayon/core");

  const apiKey = await getOrCreateApiKey(sandboxId, "./data");

  const registry = createToolRegistry();
  const tools = registry.getToolDefinitions().map((t) => ({
    name: t.name,
    description: t.description,
  }));

  return {
    url: `http://localhost:3002/mcp/${sandboxId}`,
    apiKey,
    tools,
  };
}

// Checkpoint operations
export async function getSandboxCheckpoints(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sandboxId: string
): Promise<CheckpointData[]> {
  // TODO: Implement actual checkpoint fetching from storage
  return [
    { id: "initial", name: "Initial", createdAt: new Date() },
  ];
}

export async function createSandboxCheckpoint(
  sandboxId: string,
  name: string
): Promise<CheckpointData> {
  // TODO: Implement actual checkpoint creation
  const checkpoint: CheckpointData = {
    id: `checkpoint-${Date.now()}`,
    name,
    createdAt: new Date(),
  };
  return checkpoint;
}

export async function restoreSandboxCheckpoint(
  sandboxId: string,
  checkpointId: string
): Promise<void> {
  // TODO: Implement actual checkpoint restoration
}
