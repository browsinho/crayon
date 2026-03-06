# MCP Code Tools

Reusable code manipulation tools extracted from CodeAgent for use in both the chat API and MCP server.

## ⚠️ External Integration

**USE WEB SEARCH** for documentation on:
- Search: "diff npm package typescript usage"
- Search: "nodejs path traversal prevention security"

**Reference existing implementation**: Study `packages/core/src/code-agent.ts` for current tool implementations.

## Purpose

The CodeAgent (`code-agent.ts`) contains 5 tools for file manipulation. These tools need to be reused by the MCP HTTP server. This spec extracts them into a shared module that both systems can use.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                          │
│                                                                  │
│  code-agent.ts                                                   │
│  ├── ReadFileTool      (embedded)                               │
│  ├── WriteFileTool     (embedded)                               │
│  ├── EditFileTool      (embedded)                               │
│  ├── ListFilesTool     (embedded)                               │
│  └── RunBuildTool      (embedded)                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                              ▼

┌─────────────────────────────────────────────────────────────────┐
│                     NEW ARCHITECTURE                             │
│                                                                  │
│  mcp-code-tools.ts (NEW)                                        │
│  ├── readFile()                                                  │
│  ├── writeFile()                                                 │
│  ├── editFile()                                                  │
│  ├── listFiles()                                                 │
│  ├── runBuild()                                                  │
│  └── validatePath()                                              │
│           │                                                      │
│           ├──────────────────┬──────────────────┐               │
│           ▼                  ▼                  ▼               │
│    code-agent.ts      mcp-http-server      chat-api            │
│    (uses tools)       (uses tools)         (uses tools)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] Tools extracted to `packages/core/src/mcp-code-tools.ts`
- [ ] All 5 tools work identically to current code-agent.ts implementation
- [ ] Path validation prevents sandbox escape attacks
- [ ] Blocked patterns prevent access to .env, .git, node_modules, etc.
- [ ] code-agent.ts refactored to use the extracted tools
- [ ] Unit tests cover all tools and security validations

## Interface

```typescript
// packages/core/src/mcp-code-tools.ts

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
  constructor(message: string);
}

/**
 * Validate and resolve a path within the sandbox.
 * Throws SecurityError if path escapes sandbox or matches blocked patterns.
 */
export function validatePath(sandboxPath: string, requestedPath: string): string;

// ==================== TOOLS ====================

/**
 * Read file contents with line numbers.
 */
export function readFile(
  params: {
    path: string;
    startLine?: number;
    endLine?: number;
  },
  context: CodeToolContext
): Promise<ToolResult>;

/**
 * Create or overwrite a file.
 */
export function writeFile(
  params: {
    path: string;
    content: string;
  },
  context: CodeToolContext
): Promise<ToolResult>;

/**
 * Edit a file by finding and replacing content.
 */
export function editFile(
  params: {
    path: string;
    oldContent: string;
    newContent: string;
  },
  context: CodeToolContext
): Promise<ToolResult>;

/**
 * List files and directories as a tree.
 */
export function listFiles(
  params: {
    path?: string;
    depth?: number;
  },
  context: CodeToolContext
): Promise<ToolResult>;

/**
 * Run npm build in the container.
 */
export function runBuild(
  params: Record<string, never>,
  context: CodeToolContext
): Promise<ToolResult>;

// ==================== TOOL DEFINITIONS ====================

/**
 * MCP-compatible tool definitions with JSON Schema.
 */
export const CODE_TOOL_DEFINITIONS: Array<{
  name: string;
  description: string;
  inputSchema: object;
}>;
```

## Implementation Details

### Path Validation

```typescript
const BLOCKED_PATTERNS = [
  /\.env/i,           // Environment files
  /\.git\//,          // Git directory
  /node_modules\//,   // Dependencies
  /\.ssh/,            // SSH keys
  /credentials/i,     // Credential files
  /\.pem$/i,          // Private keys
  /\.key$/i,          // Key files
];

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
```

### Tool Definitions for MCP

```typescript
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
```

## Refactor code-agent.ts

After extracting tools, update code-agent.ts to use them:

```typescript
// packages/core/src/code-agent.ts

import {
  readFile,
  writeFile,
  editFile,
  listFiles,
  runBuild,
  validatePath,
  SecurityError,
  type CodeToolContext,
  type ToolResult,
} from "./mcp-code-tools.js";

// Tool wrappers for the agent's internal tool system
const TOOLS: Tool[] = [
  {
    name: "read_file",
    description: "...", // Same as before
    parameters: z.object({ ... }),
    execute: async (params, context) => {
      const result = await readFile(params, {
        sandboxPath: context.sandboxPath,
        containerId: context.containerId,
      });
      return { success: result.success, output: result.output };
    },
  },
  // ... same pattern for other tools
];
```

## Dependencies

Already in `packages/core/package.json`:
- `diff` - For generating edit diffs

No new dependencies needed.

## Testing Requirements

### Unit Tests (`mcp-code-tools.test.ts`)

```typescript
describe("MCP Code Tools", () => {
  describe("validatePath", () => {
    const sandboxPath = "/tmp/test-sandbox";
    
    test("allows valid relative paths", () => {
      expect(() => validatePath(sandboxPath, "src/App.tsx")).not.toThrow();
      expect(() => validatePath(sandboxPath, "components/Header.tsx")).not.toThrow();
    });
    
    test("blocks path traversal with ..", () => {
      expect(() => validatePath(sandboxPath, "../etc/passwd")).toThrow(SecurityError);
      expect(() => validatePath(sandboxPath, "src/../../etc")).toThrow(SecurityError);
    });
    
    test("blocks absolute paths", () => {
      expect(() => validatePath(sandboxPath, "/etc/passwd")).toThrow(SecurityError);
    });
    
    test("blocks .env files", () => {
      expect(() => validatePath(sandboxPath, ".env")).toThrow(SecurityError);
      expect(() => validatePath(sandboxPath, ".env.local")).toThrow(SecurityError);
      expect(() => validatePath(sandboxPath, "config/.env")).toThrow(SecurityError);
    });
    
    test("blocks node_modules", () => {
      expect(() => validatePath(sandboxPath, "node_modules/lodash")).toThrow(SecurityError);
    });
    
    test("blocks .git", () => {
      expect(() => validatePath(sandboxPath, ".git/config")).toThrow(SecurityError);
    });
  });
  
  describe("readFile", () => {
    test("returns file content with line numbers", async () => {
      const result = await readFile(
        { path: "test.txt" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(true);
      expect(result.output).toContain("1 |");
    });
    
    test("respects startLine and endLine", async () => {
      const result = await readFile(
        { path: "test.txt", startLine: 5, endLine: 10 },
        { sandboxPath: testDir }
      );
      
      expect(result.output).toContain("5 |");
      expect(result.output).not.toContain("1 |");
      expect(result.output).not.toContain("11 |");
    });
    
    test("returns error for non-existent file", async () => {
      const result = await readFile(
        { path: "nonexistent.txt" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(false);
      expect(result.output).toContain("not found");
    });
  });
  
  describe("writeFile", () => {
    test("creates new file", async () => {
      const result = await writeFile(
        { path: "new-file.txt", content: "Hello" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe("create");
    });
    
    test("overwrites existing file", async () => {
      // Create file first
      await writeFile({ path: "existing.txt", content: "Old" }, { sandboxPath: testDir });
      
      const result = await writeFile(
        { path: "existing.txt", content: "New" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(true);
      expect(result.data?.action).toBe("overwrite");
    });
    
    test("creates parent directories", async () => {
      const result = await writeFile(
        { path: "deep/nested/dir/file.txt", content: "Hello" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(true);
    });
  });
  
  describe("editFile", () => {
    test("replaces exact content", async () => {
      await writeFile(
        { path: "edit-test.txt", content: "Hello World" },
        { sandboxPath: testDir }
      );
      
      const result = await editFile(
        { path: "edit-test.txt", oldContent: "World", newContent: "Universe" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(true);
      expect(result.output).toContain("Edited");
    });
    
    test("fails when content not found", async () => {
      const result = await editFile(
        { path: "edit-test.txt", oldContent: "Nonexistent", newContent: "New" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(false);
      expect(result.output).toContain("Could not find");
    });
    
    test("fails when content matches multiple times", async () => {
      await writeFile(
        { path: "multi.txt", content: "foo bar foo" },
        { sandboxPath: testDir }
      );
      
      const result = await editFile(
        { path: "multi.txt", oldContent: "foo", newContent: "baz" },
        { sandboxPath: testDir }
      );
      
      expect(result.success).toBe(false);
      expect(result.output).toContain("found 2 times");
    });
  });
  
  describe("listFiles", () => {
    test("returns directory tree", async () => {
      const result = await listFiles({}, { sandboxPath: testDir });
      
      expect(result.success).toBe(true);
      expect(result.output).toContain("├──");
    });
    
    test("skips node_modules", async () => {
      const result = await listFiles({}, { sandboxPath: testDir });
      
      expect(result.output).not.toContain("node_modules");
    });
    
    test("respects depth limit", async () => {
      const result = await listFiles({ depth: 1 }, { sandboxPath: testDir });
      
      // Should not show deeply nested files
      expect(result.success).toBe(true);
    });
  });
  
  describe("runBuild", () => {
    test("returns error when no containerId", async () => {
      const result = await runBuild({}, { sandboxPath: testDir });
      
      expect(result.success).toBe(false);
      expect(result.output).toContain("No container ID");
    });
  });
});
```

## Definition of Done

- [ ] `mcp-code-tools.ts` created with all 5 tools
- [ ] `validatePath()` blocks all security threats
- [ ] `CODE_TOOL_DEFINITIONS` exported for MCP use
- [ ] `code-agent.ts` refactored to use extracted tools
- [ ] All existing code-agent tests still pass
- [ ] New unit tests for mcp-code-tools pass
- [ ] No duplicate code between code-agent and mcp-code-tools
