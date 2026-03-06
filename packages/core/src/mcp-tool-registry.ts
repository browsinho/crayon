/**
 * MCP Tool Registry - Maps tool names to implementations
 *
 * Provides a central registry for MCP tools, mapping tool names to their
 * definitions and execution handlers. Used by both stdio and HTTP transports.
 */

import {
  readFile,
  writeFile,
  editFile,
  listFiles,
  runBuild,
  CODE_TOOL_DEFINITIONS,
  type CodeToolContext,
  type ToolResult,
} from "./mcp-code-tools.js";

// ==================== INTERFACES ====================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolRegistry {
  getToolDefinitions(): ToolDefinition[];
  executeTool(
    name: string,
    args: Record<string, unknown>,
    context: { sandboxPath: string; containerId?: string }
  ): Promise<ToolResult>;
}

// ==================== IMPLEMENTATION ====================

/**
 * Create a tool registry with all available MCP tools
 */
export function createToolRegistry(): ToolRegistry {
  const tools = new Map<
    string,
    {
      definition: ToolDefinition;
      execute: (
        args: Record<string, unknown>,
        context: CodeToolContext
      ) => Promise<ToolResult>;
    }
  >();

  // Register code tools
  tools.set("sandbox_read_file", {
    definition: CODE_TOOL_DEFINITIONS[0],
    execute: (args, ctx) =>
      readFile(
        args as { path: string; startLine?: number; endLine?: number },
        ctx
      ),
  });

  tools.set("sandbox_write_file", {
    definition: CODE_TOOL_DEFINITIONS[1],
    execute: (args, ctx) =>
      writeFile(args as { path: string; content: string }, ctx),
  });

  tools.set("sandbox_edit_file", {
    definition: CODE_TOOL_DEFINITIONS[2],
    execute: (args, ctx) =>
      editFile(
        args as { path: string; oldContent: string; newContent: string },
        ctx
      ),
  });

  tools.set("sandbox_list_files", {
    definition: CODE_TOOL_DEFINITIONS[3],
    execute: (args, ctx) =>
      listFiles(args as { path?: string; depth?: number }, ctx),
  });

  tools.set("sandbox_run_build", {
    definition: CODE_TOOL_DEFINITIONS[4],
    execute: (args, ctx) => runBuild(args as Record<string, never>, ctx),
  });

  return {
    getToolDefinitions() {
      return Array.from(tools.values()).map((t) => t.definition);
    },

    async executeTool(name, args, context) {
      const tool = tools.get(name);
      if (!tool) {
        return {
          success: false,
          output: `Unknown tool: ${name}`,
        };
      }

      return tool.execute(args, context);
    },
  };
}
