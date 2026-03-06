import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as diff from "diff";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ==================== CONTEXT ====================

export interface CodeToolContext {
  sandboxPath: string;    // Absolute path to sandbox directory
  containerId?: string;   // Docker container ID (for run_build)
}

// ==================== RESULT ====================

export interface ToolResult {
  success: boolean;
  output: string;         // Human-readable output
  data?: {
    path?: string;        // File path affected
    action?: "create" | "overwrite" | "edit";
    linesRead?: number;
    filesCount?: number;
    dirsCount?: number;
  };
}

// ==================== SECURITY ====================

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

const BLOCKED_PATTERNS = [
  /\.env/i,           // Environment files
  /\.git\//,          // Git directory
  /node_modules\//,   // Dependencies
  /\.ssh/,            // SSH keys
  /credentials/i,     // Credential files
  /\.pem$/i,          // Private keys
  /\.key$/i,          // Key files
];

/**
 * Validate and resolve a path within the sandbox.
 * Throws SecurityError if path escapes sandbox or matches blocked patterns.
 */
export function validatePath(sandboxPath: string, requestedPath: string): string {
  // Normalize the path
  const normalized = path.normalize(requestedPath);

  // Block path traversal
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new SecurityError(`Invalid path: ${requestedPath}`);
  }

  // Resolve full path
  const fullPath = path.resolve(sandboxPath, normalized);

  // Ensure within sandbox
  if (!fullPath.startsWith(path.resolve(sandboxPath))) {
    throw new SecurityError(`Path escapes sandbox: ${requestedPath}`);
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      throw new SecurityError(`Access denied: ${requestedPath}`);
    }
  }

  return fullPath;
}

// ==================== TOOLS ====================

/**
 * Read file contents with line numbers.
 */
export async function readFile(
  params: {
    path: string;
    startLine?: number;
    endLine?: number;
  },
  context: CodeToolContext
): Promise<ToolResult> {
  try {
    const fullPath = validatePath(context.sandboxPath, params.path);

    if (!existsSync(fullPath)) {
      return {
        success: false,
        output: `Error: File not found: ${params.path}`,
      };
    }

    const content = await fs.readFile(fullPath, "utf-8");
    const lines = content.split("\n");

    const startLine = params.startLine || 1;
    const endLine = params.endLine || lines.length;

    const selectedLines = lines.slice(startLine - 1, endLine);

    const maxLines = 500;
    const truncated = selectedLines.length > maxLines;
    const displayLines = truncated ? selectedLines.slice(0, maxLines) : selectedLines;

    const numbered = displayLines.map((line, i) => {
      const lineNum = startLine + i;
      return `${lineNum.toString().padStart(6)} | ${line}`;
    }).join("\n");

    let output = `File: ${params.path} (${lines.length} lines)\n`;
    output += "─".repeat(50) + "\n";
    output += numbered;

    if (truncated) {
      output += "\n\n... truncated, use startLine/endLine to read more";
    }

    return {
      success: true,
      output,
      data: {
        path: params.path,
        linesRead: displayLines.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Create or overwrite a file.
 */
export async function writeFile(
  params: {
    path: string;
    content: string;
  },
  context: CodeToolContext
): Promise<ToolResult> {
  try {
    const fullPath = validatePath(context.sandboxPath, params.path);
    const existed = existsSync(fullPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, params.content, "utf-8");

    const stats = await fs.stat(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    return {
      success: true,
      output: `✓ ${existed ? "Overwrote" : "Created"} ${params.path} (${sizeKB} KB)`,
      data: {
        path: params.path,
        action: existed ? "overwrite" : "create",
      },
    };
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Edit a file by finding and replacing content.
 */
export async function editFile(
  params: {
    path: string;
    oldContent: string;
    newContent: string;
  },
  context: CodeToolContext
): Promise<ToolResult> {
  try {
    const fullPath = validatePath(context.sandboxPath, params.path);

    if (!existsSync(fullPath)) {
      return {
        success: false,
        output: `Error: File not found: ${params.path}`,
      };
    }

    const content = await fs.readFile(fullPath, "utf-8");

    // Strategy 1: Exact match
    let matchIndex = content.indexOf(params.oldContent);

    // Strategy 2: Trim leading/trailing whitespace per line
    if (matchIndex === -1) {
      const normalizeLines = (text: string) =>
        text.split("\n").map(line => line.trim()).join("\n");

      const normalizedContent = normalizeLines(content);
      const normalizedOld = normalizeLines(params.oldContent);

      if (normalizedContent.includes(normalizedOld)) {
        matchIndex = content.indexOf(params.oldContent);
      }
    }

    if (matchIndex === -1) {
      const lineCount = content.split("\n").length;
      return {
        success: false,
        output: `Could not find the specified content in the file.

Looking for:
"""
${params.oldContent}
"""

The file contains ${lineCount} lines.

Suggestion: Use read_file to see the current content, then try again with exact text.`,
      };
    }

    // Check for multiple matches
    const occurrences = content.split(params.oldContent).length - 1;
    if (occurrences > 1) {
      return {
        success: false,
        output: `Content found ${occurrences} times. Add more context to make it unique.`,
      };
    }

    const newContent = content.replace(params.oldContent, params.newContent);
    await fs.writeFile(fullPath, newContent, "utf-8");

    // Generate diff
    const patches = diff.createPatch(params.path, params.oldContent, params.newContent, "", "");
    const diffLines = patches.split("\n").slice(4).join("\n"); // Skip header

    return {
      success: true,
      output: `✓ Edited ${params.path}\n\n${diffLines}`,
      data: {
        path: params.path,
        action: "edit",
      },
    };
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * List files and directories as a tree.
 */
export async function listFiles(
  params: {
    path?: string;
    depth?: number;
  },
  context: CodeToolContext
): Promise<ToolResult> {
  try {
    const basePath = params.path
      ? validatePath(context.sandboxPath, params.path)
      : context.sandboxPath;

    const maxDepth = params.depth || 3;
    const skipDirs = ["node_modules", ".git", "dist", ".next", "build"];

    interface FileNode {
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      children?: FileNode[];
    }

    async function buildTree(dirPath: string, currentDepth: number): Promise<FileNode[]> {
      if (currentDepth > maxDepth) return [];

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        if (skipDirs.includes(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        if (entry.isDirectory()) {
          const children = await buildTree(fullPath, currentDepth + 1);
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            size: 0,
            children,
          });
        } else {
          nodes.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            size: stats.size,
          });
        }
      }

      return nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    function formatTree(nodes: FileNode[], prefix = ""): string[] {
      const lines: string[] = [];

      nodes.forEach((node, index) => {
        const isLastChild = index === nodes.length - 1;
        const connector = isLastChild ? "└── " : "├── ";
        const sizeStr = node.isDirectory
          ? ""
          : ` (${(node.size / 1024).toFixed(2)} KB)`;

        lines.push(`${prefix}${connector}${node.name}${sizeStr}`);

        if (node.children && node.children.length > 0) {
          const newPrefix = prefix + (isLastChild ? "    " : "│   ");
          const childLines = formatTree(node.children, newPrefix);
          lines.push(...childLines);
        }
      });

      return lines;
    }

    const tree = await buildTree(basePath, 0);
    const treeLines = formatTree(tree);

    let totalFiles = 0;
    let totalDirs = 0;
    let totalSize = 0;

    function countNodes(nodes: FileNode[]) {
      for (const node of nodes) {
        if (node.isDirectory) {
          totalDirs++;
          if (node.children) countNodes(node.children);
        } else {
          totalFiles++;
          totalSize += node.size;
        }
      }
    }

    countNodes(tree);

    const output = [
      path.basename(basePath) + "/",
      ...treeLines,
      "",
      `${totalFiles} files, ${totalDirs} directories (total: ${(totalSize / 1024).toFixed(2)} KB)`,
    ].join("\n");

    return {
      success: true,
      output,
      data: {
        filesCount: totalFiles,
        dirsCount: totalDirs,
      },
    };
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Run npm build in the container.
 */
export async function runBuild(
  params: Record<string, never>,
  context: CodeToolContext
): Promise<ToolResult> {
  try {
    if (!context.containerId) {
      return {
        success: false,
        output: "Error: No container ID provided. Cannot run build.",
      };
    }

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${context.containerId} npm run build`,
        { timeout: 60000 } // 60 second timeout
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const output = [
        `✓ Build successful (${duration}s)`,
        "",
        "Output:",
        stdout,
        stderr ? `\nWarnings:\n${stderr}` : "",
        "",
        "Build completed with 0 errors.",
      ].join("\n");

      return { success: true, output };
    } catch (buildError) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      const error = buildError as { stdout?: string; stderr?: string; message?: string };
      const errorOutput = error.stdout || error.stderr || error.message || "Unknown error";

      const output = [
        `✗ Build failed (${duration}s)`,
        "",
        "Errors:",
        errorOutput,
        "",
        "Fix these errors and run build again.",
      ].join("\n");

      return { success: false, output };
    }
  } catch (error) {
    return {
      success: false,
      output: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ==================== TOOL DEFINITIONS ====================

/**
 * MCP-compatible tool definitions with JSON Schema.
 */
export const CODE_TOOL_DEFINITIONS = [
  {
    name: "sandbox_read_file",
    description: `Read a file from the sandbox with line numbers.
Use before editing to see current file state.
Supports optional line range for large files.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from sandbox root (e.g., 'src/App.tsx')",
        },
        startLine: {
          type: "number",
          description: "Line to start reading from (1-indexed, optional)",
        },
        endLine: {
          type: "number",
          description: "Line to stop reading at (inclusive, optional)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "sandbox_write_file",
    description: `Create or overwrite a file in the sandbox.
Creates parent directories if needed.
For small changes, prefer sandbox_edit_file.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path where file should be written",
        },
        content: {
          type: "string",
          description: "Complete content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "sandbox_edit_file",
    description: `Edit a file by finding and replacing content.
Provide EXACT text to find and replacement.
Include 3-5 lines of context to make match unique.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to file",
        },
        oldContent: {
          type: "string",
          description: "Exact content to find (must match including whitespace)",
        },
        newContent: {
          type: "string",
          description: "Content to replace with",
        },
      },
      required: ["path", "oldContent", "newContent"],
    },
  },
  {
    name: "sandbox_list_files",
    description: `List files and directories as a tree.
Shows file sizes. Skips node_modules, .git, dist.`,
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Subdirectory to list (optional, defaults to root)",
        },
        depth: {
          type: "number",
          description: "Max directory depth (default: 3)",
        },
      },
      required: [],
    },
  },
  {
    name: "sandbox_run_build",
    description: `Run 'npm run build' in the sandbox container.
Use after changes to verify code compiles.
Returns build output with any errors.`,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
