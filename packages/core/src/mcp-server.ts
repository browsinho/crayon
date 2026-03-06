/**
 * MCP Server - Exposes sandbox control via Model Context Protocol
 *
 * Provides MCP tools for managing sandbox state: reset, navigate, screenshot,
 * get state, modify data, UI actions, checkpoints, and natural language prompts.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Sandbox, Checkpoint } from "@crayon/types";
import type { SandboxManager } from "./sandbox-manager.js";
import type {
  CheckpointManager,
  BrowserStateProvider,
  DatabaseProvider,
} from "./checkpoint-manager.js";

// Tool input schemas
const SandboxResetSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID to reset"),
  checkpointName: z
    .string()
    .optional()
    .describe("Checkpoint name to reset to (defaults to 'initial')"),
});

const SandboxNavigateSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID"),
  url: z.string().url().describe("The URL to navigate to"),
});

const SandboxScreenshotSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID"),
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe("Capture full page screenshot"),
});

const SandboxGetStateSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID"),
});

const SandboxModifyDataSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID"),
  operation: z.enum(["create", "read", "update", "delete"]).describe("CRUD operation"),
  entity: z.string().min(1).describe("Entity type (e.g., 'user', 'product')"),
  id: z.string().optional().describe("Entity ID (required for read, update, delete)"),
  data: z.record(z.unknown()).optional().describe("Entity data (required for create, update)"),
});

const SandboxActionSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID"),
  action: z.enum(["click", "type", "scroll", "hover"]).describe("UI action type"),
  selector: z.string().min(1).describe("CSS selector for the target element"),
  value: z.string().optional().describe("Value for type action"),
  x: z.number().optional().describe("X coordinate for scroll"),
  y: z.number().optional().describe("Y coordinate for scroll"),
});

const SandboxCheckpointSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID"),
  operation: z.enum(["create", "list", "restore"]).describe("Checkpoint operation"),
  name: z.string().optional().describe("Checkpoint name (for create/restore)"),
  checkpointId: z.string().optional().describe("Checkpoint ID (for restore)"),
});

const SandboxPromptSchema = z.object({
  sandboxId: z.string().min(1).describe("The sandbox ID"),
  prompt: z.string().min(1).describe("Natural language instruction"),
});

// API key validation pattern
const API_KEY_PATTERN = /^cry_[a-zA-Z0-9]{10,}$/;

// Tool definitions for ListTools response
const TOOL_DEFINITIONS = [
  {
    name: "sandbox_reset",
    description: "Reset sandbox to a checkpoint state",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID to reset" },
        checkpointName: {
          type: "string",
          description: "Checkpoint name to reset to (defaults to 'initial')",
        },
      },
      required: ["sandboxId"],
    },
  },
  {
    name: "sandbox_navigate",
    description: "Navigate the sandbox browser to a URL",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID" },
        url: { type: "string", description: "The URL to navigate to" },
      },
      required: ["sandboxId", "url"],
    },
  },
  {
    name: "sandbox_screenshot",
    description: "Capture a screenshot of the sandbox",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID" },
        fullPage: { type: "boolean", description: "Capture full page screenshot" },
      },
      required: ["sandboxId"],
    },
  },
  {
    name: "sandbox_get_state",
    description: "Get current sandbox state (URL, DOM, data)",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID" },
      },
      required: ["sandboxId"],
    },
  },
  {
    name: "sandbox_modify_data",
    description: "Perform CRUD operations on sandbox data",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID" },
        operation: {
          type: "string",
          enum: ["create", "read", "update", "delete"],
          description: "CRUD operation",
        },
        entity: { type: "string", description: "Entity type (e.g., 'user', 'product')" },
        id: { type: "string", description: "Entity ID (required for read, update, delete)" },
        data: { type: "object", description: "Entity data (required for create, update)" },
      },
      required: ["sandboxId", "operation", "entity"],
    },
  },
  {
    name: "sandbox_action",
    description: "Perform UI actions (click, type, scroll, hover)",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID" },
        action: {
          type: "string",
          enum: ["click", "type", "scroll", "hover"],
          description: "UI action type",
        },
        selector: { type: "string", description: "CSS selector for the target element" },
        value: { type: "string", description: "Value for type action" },
        x: { type: "number", description: "X coordinate for scroll" },
        y: { type: "number", description: "Y coordinate for scroll" },
      },
      required: ["sandboxId", "action", "selector"],
    },
  },
  {
    name: "sandbox_checkpoint",
    description: "Create, list, or restore checkpoints",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID" },
        operation: {
          type: "string",
          enum: ["create", "list", "restore"],
          description: "Checkpoint operation",
        },
        name: { type: "string", description: "Checkpoint name (for create/restore)" },
        checkpointId: { type: "string", description: "Checkpoint ID (for restore)" },
      },
      required: ["sandboxId", "operation"],
    },
  },
  {
    name: "sandbox_prompt",
    description: "Modify sandbox via natural language instruction",
    inputSchema: {
      type: "object" as const,
      properties: {
        sandboxId: { type: "string", description: "The sandbox ID" },
        prompt: { type: "string", description: "Natural language instruction" },
      },
      required: ["sandboxId", "prompt"],
    },
  },
];

export interface McpServerConfig {
  name?: string;
  version?: string;
  apiKey?: string;
  sandboxManager: SandboxManager;
  checkpointManager: CheckpointManager;
  browserStateProvider?: (sandboxId: string) => BrowserStateProvider;
  databaseProvider?: (sandboxId: string) => DatabaseProvider;
  onNavigate?: (sandboxId: string, url: string) => Promise<void>;
  onScreenshot?: (sandboxId: string, fullPage: boolean) => Promise<string>;
  onGetState?: (sandboxId: string) => Promise<SandboxState>;
  onModifyData?: (
    sandboxId: string,
    operation: string,
    entity: string,
    id?: string,
    data?: Record<string, unknown>
  ) => Promise<unknown>;
  onAction?: (
    sandboxId: string,
    action: string,
    selector: string,
    options?: { value?: string; x?: number; y?: number }
  ) => Promise<void>;
  onPrompt?: (sandboxId: string, prompt: string) => Promise<string>;
}

export interface SandboxState {
  url: string;
  title: string;
  dom?: string;
  data?: Record<string, unknown>;
}

export type McpServerErrorCode =
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "OPERATION_FAILED"
  | "NOT_IMPLEMENTED";

export class McpServerError extends Error {
  constructor(
    message: string,
    public readonly code: McpServerErrorCode
  ) {
    super(message);
    this.name = "McpServerError";
  }
}

/**
 * Create an MCP Server instance
 */
export function createMcpServer(config: McpServerConfig): McpServer {
  return new McpServer(config);
}

export class McpServer {
  private readonly server: Server;
  private readonly config: McpServerConfig;
  private transport: StdioServerTransport | null = null;

  constructor(config: McpServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: config.name ?? "crayon-sandbox",
        version: config.version ?? "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Validate API key format
   */
  validateApiKey(apiKey: string | undefined): boolean {
    if (!this.config.apiKey) {
      return true; // No API key configured, allow all
    }
    if (!apiKey) {
      return false;
    }
    return API_KEY_PATTERN.test(apiKey) && apiKey === this.config.apiKey;
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOL_DEFINITIONS };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args ?? {});
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode =
          error instanceof McpServerError ? error.code : "OPERATION_FAILED";

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: errorMessage, code: errorCode }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Handle individual tool calls
   */
  async handleToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      case "sandbox_reset":
        return this.handleSandboxReset(args);
      case "sandbox_navigate":
        return this.handleSandboxNavigate(args);
      case "sandbox_screenshot":
        return this.handleSandboxScreenshot(args);
      case "sandbox_get_state":
        return this.handleSandboxGetState(args);
      case "sandbox_modify_data":
        return this.handleSandboxModifyData(args);
      case "sandbox_action":
        return this.handleSandboxAction(args);
      case "sandbox_checkpoint":
        return this.handleSandboxCheckpoint(args);
      case "sandbox_prompt":
        return this.handleSandboxPrompt(args);
      default:
        throw new McpServerError(`Unknown tool: ${toolName}`, "NOT_FOUND");
    }
  }

  /**
   * Handle sandbox_reset tool
   */
  private async handleSandboxReset(
    args: Record<string, unknown>
  ): Promise<{ success: boolean; sandbox: Sandbox }> {
    const parsed = SandboxResetSchema.parse(args);
    const { sandboxId, checkpointName = "initial" } = parsed;

    // Check sandbox exists
    const sandbox = await this.config.sandboxManager.getStatus(sandboxId);

    // Get providers
    const browserStateProvider = this.config.browserStateProvider?.(sandboxId);
    const databaseProvider = this.config.databaseProvider?.(sandboxId);

    if (browserStateProvider && databaseProvider) {
      // Get checkpoint by name and restore
      const checkpoint = await this.config.checkpointManager.getByName(
        sandboxId,
        checkpointName
      );
      if (!checkpoint) {
        throw new McpServerError(
          `Checkpoint '${checkpointName}' not found`,
          "NOT_FOUND"
        );
      }

      await this.config.checkpointManager.restore(
        sandboxId,
        checkpoint.id,
        browserStateProvider,
        databaseProvider
      );
    }

    return { success: true, sandbox };
  }

  /**
   * Handle sandbox_navigate tool
   */
  private async handleSandboxNavigate(
    args: Record<string, unknown>
  ): Promise<{ success: boolean; url: string }> {
    const parsed = SandboxNavigateSchema.parse(args);
    const { sandboxId, url } = parsed;

    // Verify sandbox exists and is running
    const sandbox = await this.config.sandboxManager.getStatus(sandboxId);
    if (sandbox.status !== "running") {
      throw new McpServerError(
        `Sandbox '${sandboxId}' is not running`,
        "OPERATION_FAILED"
      );
    }

    if (this.config.onNavigate) {
      await this.config.onNavigate(sandboxId, url);
    } else {
      throw new McpServerError(
        "Navigation handler not configured",
        "NOT_IMPLEMENTED"
      );
    }

    return { success: true, url };
  }

  /**
   * Handle sandbox_screenshot tool
   */
  private async handleSandboxScreenshot(
    args: Record<string, unknown>
  ): Promise<{ success: boolean; screenshot: string }> {
    const parsed = SandboxScreenshotSchema.parse(args);
    const { sandboxId, fullPage } = parsed;

    // Verify sandbox exists and is running
    const sandbox = await this.config.sandboxManager.getStatus(sandboxId);
    if (sandbox.status !== "running") {
      throw new McpServerError(
        `Sandbox '${sandboxId}' is not running`,
        "OPERATION_FAILED"
      );
    }

    if (this.config.onScreenshot) {
      const screenshot = await this.config.onScreenshot(sandboxId, fullPage);
      return { success: true, screenshot };
    } else {
      throw new McpServerError(
        "Screenshot handler not configured",
        "NOT_IMPLEMENTED"
      );
    }
  }

  /**
   * Handle sandbox_get_state tool
   */
  private async handleSandboxGetState(
    args: Record<string, unknown>
  ): Promise<{ sandbox: Sandbox; state: SandboxState | null }> {
    const parsed = SandboxGetStateSchema.parse(args);
    const { sandboxId } = parsed;

    const sandbox = await this.config.sandboxManager.getStatus(sandboxId);

    let state: SandboxState | null = null;
    if (sandbox.status === "running" && this.config.onGetState) {
      state = await this.config.onGetState(sandboxId);
    }

    return { sandbox, state };
  }

  /**
   * Handle sandbox_modify_data tool
   */
  private async handleSandboxModifyData(
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result: unknown }> {
    const parsed = SandboxModifyDataSchema.parse(args);
    const { sandboxId, operation, entity, id, data } = parsed;

    // Verify sandbox exists
    await this.config.sandboxManager.getStatus(sandboxId);

    // Validate required fields based on operation
    if ((operation === "read" || operation === "update" || operation === "delete") && !id) {
      throw new McpServerError(
        `Entity ID required for ${operation} operation`,
        "INVALID_INPUT"
      );
    }
    if ((operation === "create" || operation === "update") && !data) {
      throw new McpServerError(
        `Entity data required for ${operation} operation`,
        "INVALID_INPUT"
      );
    }

    if (this.config.onModifyData) {
      const result = await this.config.onModifyData(
        sandboxId,
        operation,
        entity,
        id,
        data
      );
      return { success: true, result };
    } else {
      throw new McpServerError(
        "Data modification handler not configured",
        "NOT_IMPLEMENTED"
      );
    }
  }

  /**
   * Handle sandbox_action tool
   */
  private async handleSandboxAction(
    args: Record<string, unknown>
  ): Promise<{ success: boolean }> {
    const parsed = SandboxActionSchema.parse(args);
    const { sandboxId, action, selector, value, x, y } = parsed;

    // Verify sandbox exists and is running
    const sandbox = await this.config.sandboxManager.getStatus(sandboxId);
    if (sandbox.status !== "running") {
      throw new McpServerError(
        `Sandbox '${sandboxId}' is not running`,
        "OPERATION_FAILED"
      );
    }

    // Validate action-specific requirements
    if (action === "type" && !value) {
      throw new McpServerError(
        "Value required for type action",
        "INVALID_INPUT"
      );
    }

    if (this.config.onAction) {
      await this.config.onAction(sandboxId, action, selector, { value, x, y });
      return { success: true };
    } else {
      throw new McpServerError(
        "Action handler not configured",
        "NOT_IMPLEMENTED"
      );
    }
  }

  /**
   * Handle sandbox_checkpoint tool
   */
  private async handleSandboxCheckpoint(
    args: Record<string, unknown>
  ): Promise<{ success: boolean; checkpoints?: Checkpoint[]; checkpoint?: Checkpoint }> {
    const parsed = SandboxCheckpointSchema.parse(args);
    const { sandboxId, operation, name, checkpointId } = parsed;

    // Verify sandbox exists
    await this.config.sandboxManager.getStatus(sandboxId);

    const browserStateProvider = this.config.browserStateProvider?.(sandboxId);
    const databaseProvider = this.config.databaseProvider?.(sandboxId);

    switch (operation) {
      case "list": {
        const checkpoints = await this.config.checkpointManager.list(sandboxId);
        return { success: true, checkpoints };
      }

      case "create": {
        if (!name) {
          throw new McpServerError(
            "Checkpoint name required for create operation",
            "INVALID_INPUT"
          );
        }
        if (!browserStateProvider || !databaseProvider) {
          throw new McpServerError(
            "Browser state and database providers required for create",
            "NOT_IMPLEMENTED"
          );
        }
        const checkpoint = await this.config.checkpointManager.create(
          sandboxId,
          name,
          browserStateProvider,
          databaseProvider
        );
        return { success: true, checkpoint };
      }

      case "restore": {
        if (!checkpointId && !name) {
          throw new McpServerError(
            "Checkpoint ID or name required for restore operation",
            "INVALID_INPUT"
          );
        }
        if (!browserStateProvider || !databaseProvider) {
          throw new McpServerError(
            "Browser state and database providers required for restore",
            "NOT_IMPLEMENTED"
          );
        }

        let cpId = checkpointId;
        if (!cpId && name) {
          const cp = await this.config.checkpointManager.getByName(sandboxId, name);
          if (!cp) {
            throw new McpServerError(
              `Checkpoint '${name}' not found`,
              "NOT_FOUND"
            );
          }
          cpId = cp.id;
        }

        await this.config.checkpointManager.restore(
          sandboxId,
          cpId!,
          browserStateProvider,
          databaseProvider
        );
        return { success: true };
      }

      default:
        throw new McpServerError(
          `Unknown checkpoint operation: ${operation}`,
          "INVALID_INPUT"
        );
    }
  }

  /**
   * Handle sandbox_prompt tool
   */
  private async handleSandboxPrompt(
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result: string }> {
    const parsed = SandboxPromptSchema.parse(args);
    const { sandboxId, prompt } = parsed;

    // Verify sandbox exists
    await this.config.sandboxManager.getStatus(sandboxId);

    if (this.config.onPrompt) {
      const result = await this.config.onPrompt(sandboxId, prompt);
      return { success: true, result };
    } else {
      throw new McpServerError(
        "Prompt handler not configured",
        "NOT_IMPLEMENTED"
      );
    }
  }

  /**
   * Start the MCP server with stdio transport
   */
  async listen(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
  }

  /**
   * Close the MCP server
   */
  async close(): Promise<void> {
    await this.server.close();
    this.transport = null;
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): Server {
    return this.server;
  }
}
