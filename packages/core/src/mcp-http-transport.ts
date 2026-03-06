/**
 * MCP HTTP Transport - HTTP/SSE transport for MCP server
 *
 * Provides HTTP and Server-Sent Events (SSE) endpoints for MCP communication,
 * enabling external AI clients to connect via HTTP instead of stdio.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import type { ToolRegistry } from "./mcp-tool-registry.js";

// ==================== MCP ERROR CODES ====================

const MCP_ERRORS = {
  PARSE_ERROR: -32700, // Invalid JSON
  INVALID_REQUEST: -32600, // Not valid JSON-RPC
  METHOD_NOT_FOUND: -32601, // Unknown method
  INVALID_PARAMS: -32602, // Invalid method params
  INTERNAL_ERROR: -32603, // Internal error

  // Custom errors (application-defined)
  AUTH_ERROR: -32000, // Invalid API key
  SANDBOX_NOT_FOUND: -32001, // Sandbox doesn't exist
  TOOL_NOT_FOUND: -32002, // Tool doesn't exist
  TOOL_ERROR: -32003, // Tool execution failed
};

// ==================== CONFIGURATION ====================

export interface HttpTransportConfig {
  /**
   * Resolve sandbox info from sandboxId.
   * Return null if sandbox doesn't exist.
   */
  sandboxResolver: (sandboxId: string) => Promise<SandboxInfo | null>;

  /**
   * Validate API key. Return true if valid.
   * If not provided, all requests are allowed.
   */
  apiKeyValidator?: (apiKey: string) => Promise<boolean>;

  /**
   * Tool registry with available tools.
   */
  toolRegistry: ToolRegistry;

  /**
   * Called when a tool is invoked (for logging).
   */
  onToolCall?: (event: ToolCallEvent) => void;
}

export interface SandboxInfo {
  sandboxPath: string;
  containerId?: string;
  status: "running" | "stopped" | "error";
}

export interface ToolCallEvent {
  sandboxId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: Date;
}

// ==================== JSON-RPC TYPES ====================

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Extend Express Request with custom properties
interface McpRequest extends Request {
  sandbox?: SandboxInfo;
  sandboxId?: string;
}

// ==================== FACTORY ====================

/**
 * Create an Express router for MCP HTTP transport.
 */
export function createMcpRouter(config: HttpTransportConfig): Router {
  const router = Router();

  // ==================== MIDDLEWARE ====================

  // API key validation
  const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!config.apiKeyValidator) {
      return next();
    }

    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: MCP_ERRORS.AUTH_ERROR, message: "Missing API key" },
      });
      return;
    }

    const valid = await config.apiKeyValidator(apiKey);
    if (!valid) {
      res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: MCP_ERRORS.AUTH_ERROR, message: "Invalid API key" },
      });
      return;
    }

    next();
  };

  // Sandbox resolution
  const sandboxMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { sandboxId } = req.params;

    const sandbox = await config.sandboxResolver(sandboxId);
    if (!sandbox) {
      res.status(404).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: MCP_ERRORS.SANDBOX_NOT_FOUND,
          message: `Sandbox '${sandboxId}' not found`,
        },
      });
      return;
    }

    // Attach to request
    const mcpReq = req as McpRequest;
    mcpReq.sandbox = sandbox;
    mcpReq.sandboxId = sandboxId;

    next();
  };

  // Apply middleware
  router.use("/:sandboxId", authMiddleware, sandboxMiddleware);

  // ==================== SSE ENDPOINT ====================

  router.get("/:sandboxId", (req: Request, res: Response) => {
    const mcpReq = req as McpRequest;
    const sandboxId = mcpReq.sandboxId!;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ sandboxId })}\n\n`);

    // Keep-alive heartbeat
    const heartbeat = setInterval(() => {
      res.write(":keepalive\n\n");
    }, 15000);

    // Cleanup on disconnect
    req.on("close", () => {
      clearInterval(heartbeat);
    });
  });

  // ==================== JSON-RPC ENDPOINT ====================

  router.post("/:sandboxId", async (req: Request, res: Response) => {
    const mcpReq = req as McpRequest;
    const sandboxId = mcpReq.sandboxId!;
    const sandbox = mcpReq.sandbox!;
    const { jsonrpc, id, method, params } = req.body as JsonRpcRequest;

    // Validate JSON-RPC format
    if (jsonrpc !== "2.0") {
      res.status(400).json({
        jsonrpc: "2.0",
        id: id ?? null,
        error: {
          code: MCP_ERRORS.INVALID_REQUEST,
          message: "Invalid JSON-RPC version",
        },
      });
      return;
    }

    try {
      switch (method) {
        case "tools/list": {
          const tools = config.toolRegistry.getToolDefinitions();
          res.json({
            jsonrpc: "2.0",
            id,
            result: { tools },
          } as JsonRpcResponse);
          return;
        }

        case "tools/call": {
          const { name, arguments: args = {} } = (params || {}) as {
            name?: string;
            arguments?: Record<string, unknown>;
          };

          if (!name) {
            res.status(400).json({
              jsonrpc: "2.0",
              id,
              error: {
                code: MCP_ERRORS.INVALID_PARAMS,
                message: "Missing tool name",
              },
            });
            return;
          }

          // Log tool call
          if (config.onToolCall) {
            config.onToolCall({
              sandboxId,
              toolName: name,
              input: args,
              timestamp: new Date(),
            });
          }

          // Execute tool
          const result = await config.toolRegistry.executeTool(name, args, {
            sandboxPath: sandbox.sandboxPath,
            containerId: sandbox.containerId,
          });

          res.json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: result.output }],
              isError: !result.success,
            },
          } as JsonRpcResponse);
          return;
        }

        default:
          res.status(400).json({
            jsonrpc: "2.0",
            id,
            error: {
              code: MCP_ERRORS.METHOD_NOT_FOUND,
              message: `Unknown method: ${method}`,
            },
          });
          return;
      }
    } catch (error) {
      res.status(500).json({
        jsonrpc: "2.0",
        id,
        error: {
          code: MCP_ERRORS.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Internal error",
        },
      });
    }
  });

  // ==================== CONVENIENCE ENDPOINT ====================

  router.get("/:sandboxId/tools", (req: Request, res: Response) => {
    const tools = config.toolRegistry.getToolDefinitions();
    res.json({ tools });
  });

  return router;
}
